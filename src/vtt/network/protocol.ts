/**
 * Pure (no I/O) building blocks for host-authoritative multiplayer:
 *  - strict validation of everything that arrives over the wire
 *  - per-object scene deltas (diff / apply) instead of whole-scene snapshots
 *  - authorization of a delta for a given sender
 *
 * Nothing received from a peer is trusted until it passes through here.
 */
import { moveCircleSwept } from '../geometry/collision';
import type {
  Door, FloorTile, ID, Light, MapImage, Scene, Token, Wall, Window as SceneWindow,
} from '../scene/SceneTypes';

export const COLLECTIONS = ['floors', 'walls', 'doors', 'lights', 'tokens', 'windows', 'images'] as const;
export type CollectionKey = (typeof COLLECTIONS)[number];

type EntityMap = {
  floors: FloorTile;
  walls: Wall;
  doors: Door;
  lights: Light;
  tokens: Token;
  windows: SceneWindow;
  images: MapImage;
};
export type EntityOf<K extends CollectionKey> = EntityMap[K];

const SETTING_KEYS = ['gridSize', 'mapWidth', 'mapHeight', 'ambientLightLevel', 'ambientLightColor'] as const;
export type SceneSettings = Pick<Scene, (typeof SETTING_KEYS)[number]>;

export type Delta = {
  settings?: Partial<SceneSettings>;
  upsert?: { [K in CollectionKey]?: EntityOf<K>[] };
  remove?: { [K in CollectionKey]?: ID[] };
};

// ── Limits ───────────────────────────────────────────────────────────────

const MAX_ITEMS: Record<CollectionKey, number> = {
  floors: 50_000, walls: 5_000, doors: 2_000, lights: 500, tokens: 1_000, windows: 2_000, images: 200,
};
const MAX_ID_LEN = 64;
const MAX_TEXT_LEN = 100;
const MAX_URL_LEN = 8_000_000; // data-URL portraits / map images
const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const IMAGE_URL_RE = /^(?:data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,|https?:\/\/)/i;

// ── Primitive validators ─────────────────────────────────────────────────

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isStr = (v: unknown, max = MAX_TEXT_LEN): v is string => typeof v === 'string' && v.length <= max;
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LEN;
const isColor = (v: unknown): v is string => typeof v === 'string' && COLOR_RE.test(v);
const isImageUrl = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= MAX_URL_LEN && IMAGE_URL_RE.test(v);
const inRange = (v: unknown, lo: number, hi: number): v is number => isNum(v) && v >= lo && v <= hi;

export function isValidColor(v: unknown): v is string {
  return isColor(v);
}

// ── Entity validators (whitelist: unknown fields are dropped) ────────────

type Validator<T> = (v: unknown) => T | null;

/**
 * PeerJS's binary serializer turns `undefined` into `null`. Optional fields
 * therefore arrive as `null` when unset: treat that as "absent".
 */
function stripNulls(v: unknown): unknown {
  if (!isRec(v)) return v;
  const out: Rec = {};
  for (const k of Object.keys(v)) if (v[k] !== null) out[k] = v[k];
  return out;
}

const validateFloor: Validator<FloorTile> = (raw) => {
  const v = stripNulls(raw);
  if (!isRec(v) || !isId(v.id) || !isNum(v.gridX) || !isNum(v.gridY) || !isNum(v.elevation)) return null;
  if (v.materialId !== undefined && !isId(v.materialId)) return null;
  const out: FloorTile = { id: v.id, gridX: v.gridX, gridY: v.gridY, elevation: v.elevation };
  if (v.materialId !== undefined) out.materialId = v.materialId as string;
  return out;
};

const validateWall: Validator<Wall> = (v) => {
  if (!isRec(v) || !isId(v.id)) return null;
  if (!isNum(v.x1) || !isNum(v.y1) || !isNum(v.x2) || !isNum(v.y2) || !isNum(v.elevation)) return null;
  if (!isBool(v.blocksVision) || !isBool(v.blocksMovement)) return null;
  return {
    id: v.id, x1: v.x1, y1: v.y1, x2: v.x2, y2: v.y2, elevation: v.elevation,
    blocksVision: v.blocksVision, blocksMovement: v.blocksMovement,
  };
};

const validateDoor: Validator<Door> = (raw) => {
  const v = stripNulls(raw);
  if (!isRec(v) || !isId(v.id) || !isId(v.wallId) || !isNum(v.position) || !isNum(v.width)) return null;
  if (v.state !== 'open' && v.state !== 'closed') return null;
  if (!isBool(v.locked) || !isBool(v.hidden)) return null;
  if (v.swingDirection !== undefined && v.swingDirection !== 1 && v.swingDirection !== -1) return null;
  const out: Door = {
    id: v.id, wallId: v.wallId, position: v.position, width: v.width,
    state: v.state, locked: v.locked, hidden: v.hidden,
  };
  if (v.swingDirection !== undefined) out.swingDirection = v.swingDirection as 1 | -1;
  return out;
};

const validateWindow: Validator<SceneWindow> = (v) => {
  if (!isRec(v) || !isId(v.id) || !isId(v.wallId) || !isNum(v.position) || !isNum(v.width)) return null;
  return { id: v.id, wallId: v.wallId, position: v.position, width: v.width };
};

const validateLight: Validator<Light> = (v) => {
  if (!isRec(v) || !isId(v.id) || !isNum(v.x) || !isNum(v.y) || !isNum(v.elevation)) return null;
  if (!inRange(v.radius, 0, 100_000) || !isColor(v.color) || !isBool(v.enabled)) return null;
  return { id: v.id, x: v.x, y: v.y, elevation: v.elevation, radius: v.radius, color: v.color, enabled: v.enabled };
};

const validateToken: Validator<Token> = (raw) => {
  const v = stripNulls(raw);
  if (!isRec(v) || !isId(v.id) || !isNum(v.x) || !isNum(v.y) || !isNum(v.elevation)) return null;
  if (!inRange(v.radius, 0, 100_000) || !inRange(v.visionRadius, 0, 100_000)) return null;
  if (v.ownerId !== undefined && !isId(v.ownerId)) return null;
  if (v.name !== undefined && !isStr(v.name)) return null;
  if (v.imageUrl !== undefined && !isImageUrl(v.imageUrl)) return null;
  if (v.hidden !== undefined && !isBool(v.hidden)) return null;
  const out: Token = {
    id: v.id, x: v.x, y: v.y, elevation: v.elevation, radius: v.radius, visionRadius: v.visionRadius,
  };
  if (v.ownerId !== undefined) out.ownerId = v.ownerId as string;
  if (v.name !== undefined) out.name = v.name as string;
  if (v.imageUrl !== undefined) out.imageUrl = v.imageUrl as string;
  if (v.hidden !== undefined) out.hidden = v.hidden as boolean;
  return out;
};

const validateImage: Validator<MapImage> = (v) => {
  if (!isRec(v) || !isId(v.id) || !isImageUrl(v.url)) return null;
  if (!isNum(v.x) || !isNum(v.y) || !inRange(v.width, 0, 1_000_000) || !inRange(v.height, 0, 1_000_000)) return null;
  if (!inRange(v.opacity, 0, 1) || !isBool(v.locked)) return null;
  return { id: v.id, url: v.url, x: v.x, y: v.y, width: v.width, height: v.height, opacity: v.opacity, locked: v.locked };
};

const VALIDATORS: { [K in CollectionKey]: Validator<EntityOf<K>> } = {
  floors: validateFloor,
  walls: validateWall,
  doors: validateDoor,
  lights: validateLight,
  tokens: validateToken,
  windows: validateWindow,
  images: validateImage,
};

function validateSettings(raw: unknown): Partial<SceneSettings> | null {
  const v = stripNulls(raw);
  if (!isRec(v)) return null;
  const out: Partial<SceneSettings> = {};
  if (v.gridSize !== undefined) { if (!inRange(v.gridSize, 5, 500)) return null; out.gridSize = v.gridSize; }
  if (v.mapWidth !== undefined) { if (!inRange(v.mapWidth, 1, 2000)) return null; out.mapWidth = v.mapWidth; }
  if (v.mapHeight !== undefined) { if (!inRange(v.mapHeight, 1, 2000)) return null; out.mapHeight = v.mapHeight; }
  if (v.ambientLightLevel !== undefined) {
    if (!inRange(v.ambientLightLevel, 0, 1)) return null;
    out.ambientLightLevel = v.ambientLightLevel;
  }
  if (v.ambientLightColor !== undefined) {
    if (!isColor(v.ambientLightColor)) return null;
    out.ambientLightColor = v.ambientLightColor;
  }
  return out;
}

function validateList<K extends CollectionKey>(key: K, raw: unknown): EntityOf<K>[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS[key]) return null;
  const out: EntityOf<K>[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const ok = (VALIDATORS[key] as Validator<EntityOf<K>>)(item);
    if (!ok || seen.has(ok.id)) return null;
    seen.add(ok.id);
    out.push(ok);
  }
  return out;
}

/** Strictly validates a full scene. Returns a sanitized copy, or null if anything is off. */
export function validateScene(raw: unknown): Scene | null {
  if (!isRec(raw)) return null;
  const settings = validateSettings(raw);
  if (!settings || settings.gridSize === undefined || settings.mapWidth === undefined || settings.mapHeight === undefined) {
    return null;
  }
  const scene: Scene = {
    gridSize: settings.gridSize,
    mapWidth: settings.mapWidth,
    mapHeight: settings.mapHeight,
    floors: [], walls: [], doors: [], lights: [], tokens: [], windows: [], images: [],
  };
  if (settings.ambientLightLevel !== undefined) scene.ambientLightLevel = settings.ambientLightLevel;
  if (settings.ambientLightColor !== undefined) scene.ambientLightColor = settings.ambientLightColor;
  for (const key of COLLECTIONS) {
    const list = validateList(key, raw[key]);
    if (!list) return null;
    (scene[key] as unknown[]) = list;
  }
  return scene;
}

/** Strictly validates a delta. Returns a sanitized copy, or null if anything is off. */
export function validateDelta(raw: unknown): Delta | null {
  if (!isRec(raw)) return null;
  const out: Delta = {};
  if (raw.settings !== undefined) {
    const s = validateSettings(raw.settings);
    if (!s) return null;
    out.settings = s;
  }
  if (raw.upsert !== undefined) {
    if (!isRec(raw.upsert)) return null;
    const upsert: NonNullable<Delta['upsert']> = {};
    for (const key of COLLECTIONS) {
      if (raw.upsert[key] === undefined) continue;
      const list = validateList(key, raw.upsert[key]);
      if (!list) return null;
      (upsert[key] as unknown[]) = list;
    }
    out.upsert = upsert;
  }
  if (raw.remove !== undefined) {
    if (!isRec(raw.remove)) return null;
    const remove: NonNullable<Delta['remove']> = {};
    for (const key of COLLECTIONS) {
      const ids = raw.remove[key];
      if (ids === undefined) continue;
      if (!Array.isArray(ids) || ids.length > MAX_ITEMS[key] || !ids.every(isId)) return null;
      remove[key] = ids as ID[];
    }
    out.remove = remove;
  }
  return out;
}

// ── Delta: diff / apply ──────────────────────────────────────────────────

/** Flat-object equality where `{k: undefined}` and a missing `k` are the same. */
function shallowEqual(a: object, b: object): boolean {
  const ra = a as Rec;
  const rb = b as Rec;
  for (const k of Object.keys(ra)) if (ra[k] !== rb[k]) return false;
  for (const k of Object.keys(rb)) if (ra[k] !== rb[k]) return false;
  return true;
}

export function isEmptyDelta(d: Delta): boolean {
  if (d.settings && Object.keys(d.settings).length > 0) return false;
  for (const key of COLLECTIONS) {
    if (d.upsert?.[key]?.length) return false;
    if (d.remove?.[key]?.length) return false;
  }
  return true;
}

/** Minimal per-object change set that turns `prev` into `next`. */
export function diffScenes(prev: Scene, next: Scene): Delta {
  const delta: Delta = {};

  const settings: Partial<SceneSettings> = {};
  for (const k of SETTING_KEYS) {
    if (prev[k] !== next[k] && next[k] !== undefined) (settings as Rec)[k] = next[k];
  }
  if (Object.keys(settings).length > 0) delta.settings = settings;

  for (const key of COLLECTIONS) {
    const before = new Map<string, object>((prev[key] as { id: string }[]).map((e) => [e.id, e]));
    const upserts: object[] = [];
    const seen = new Set<string>();
    for (const e of next[key] as { id: string }[]) {
      seen.add(e.id);
      const old = before.get(e.id);
      if (!old || !shallowEqual(old, e)) upserts.push(e);
    }
    const removed = [...before.keys()].filter((id) => !seen.has(id));
    if (upserts.length) ((delta.upsert ??= {})[key] as object[]) = upserts;
    if (removed.length) (delta.remove ??= {})[key] = removed;
  }
  return delta;
}

/** Returns a new scene with `delta` applied. Does not mutate `scene`. */
export function applyDelta(scene: Scene, delta: Delta): Scene {
  const next: Scene = { ...scene };
  if (delta.settings) Object.assign(next, delta.settings);

  for (const key of COLLECTIONS) {
    const upserts = delta.upsert?.[key] as { id: string }[] | undefined;
    const removes = delta.remove?.[key];
    if (!upserts?.length && !removes?.length) continue;

    let list = (scene[key] as { id: string }[]).slice();
    if (removes?.length) {
      const drop = new Set(removes);
      list = list.filter((e) => !drop.has(e.id));
    }
    if (upserts?.length) {
      const index = new Map(list.map((e, i) => [e.id, i]));
      for (const e of upserts) {
        const i = index.get(e.id);
        if (i === undefined) { index.set(e.id, list.length); list.push(e); } else list[i] = e;
      }
    }
    (next[key] as unknown[]) = list;
  }
  return next;
}

// ── Authorization ────────────────────────────────────────────────────────

export type Viewer = {
  isGM: boolean;
  /** Stable public player id, or null for an unidentified spectator. */
  playerId: string | null;
};

/**
 * Decides what part of a client-sent delta the host will accept.
 *  - GM: everything (already validated).
 *  - Player: only x/y of tokens they own, and only to somewhere that token could really
 *    have walked (inside the map, not through walls or closed doors). All else is dropped.
 * `trimmed` is true when something was dropped, so the host can resync the sender.
 */
export function authorizeDelta(
  delta: Delta,
  scene: Scene,
  viewer: Viewer,
): { delta: Delta; trimmed: boolean } {
  if (viewer.isGM) return { delta, trimmed: false };

  const accepted: Token[] = [];
  let trimmed = false;

  if (delta.settings && Object.keys(delta.settings).length > 0) trimmed = true;
  for (const key of COLLECTIONS) {
    if (delta.remove?.[key]?.length) trimmed = true;
    if (key !== 'tokens' && delta.upsert?.[key]?.length) trimmed = true;
  }

  for (const t of delta.upsert?.tokens ?? []) {
    const current = scene.tokens.find((c) => c.id === t.id);
    if (!current || !viewer.playerId || current.ownerId !== viewer.playerId) { trimmed = true; continue; }
    // Anything other than a position change (visionRadius, owner, name, …) is not the player's call.
    if (!shallowEqual({ ...t }, { ...current, x: t.x, y: t.y })) trimmed = true;

    // Where the token may actually end up: inside the map, and not through walls / closed doors.
    const g = scene.gridSize;
    const bx = scene.mapWidth * g;
    const by = scene.mapHeight * g;
    const target = { x: Math.min(Math.max(t.x, 0), bx), y: Math.min(Math.max(t.y, 0), by) };
    const end = moveCircleSwept({ x: current.x, y: current.y }, target, current.radius, scene, { elevation: 0 });
    // Small path-dependent differences from the client's own prediction are fine (and silent);
    // a big correction means the client lied or diverged, so make it resync.
    if (Math.hypot(end.x - t.x, end.y - t.y) > Math.max(current.radius, 5)) trimmed = true;
    accepted.push({ ...current, x: end.x, y: end.y });
  }

  const out: Delta = accepted.length ? { upsert: { tokens: accepted } } : {};
  return { delta: out, trimmed };
}

// ── Ephemeral events (cursors, pings, rulers) ────────────────────────────

export type EphemeralEvent =
  | { type: 'CURSOR'; x: number; y: number; color: string; name: string }
  | { type: 'PING'; x: number; y: number; color: string }
  | { type: 'RULER_UPDATE'; startX: number; startY: number; endX: number; endY: number; color: string }
  | { type: 'RULER_REMOVE' };

export function validateEphemeral(raw: unknown): EphemeralEvent | null {
  if (!isRec(raw)) return null;
  switch (raw.type) {
    case 'CURSOR':
      if (!isNum(raw.x) || !isNum(raw.y) || !isColor(raw.color) || !isStr(raw.name, 40)) return null;
      return { type: 'CURSOR', x: raw.x, y: raw.y, color: raw.color, name: raw.name };
    case 'PING':
      if (!isNum(raw.x) || !isNum(raw.y) || !isColor(raw.color)) return null;
      return { type: 'PING', x: raw.x, y: raw.y, color: raw.color };
    case 'RULER_UPDATE':
      if (!isNum(raw.startX) || !isNum(raw.startY) || !isNum(raw.endX) || !isNum(raw.endY) || !isColor(raw.color)) return null;
      return { type: 'RULER_UPDATE', startX: raw.startX, startY: raw.startY, endX: raw.endX, endY: raw.endY, color: raw.color };
    case 'RULER_REMOVE':
      return { type: 'RULER_REMOVE' };
    default:
      return null;
  }
}

// ── Wire envelope ────────────────────────────────────────────────────────

export type PlayerInfo = { id: string; isGM: boolean };

export const isPlayerId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}$/.test(v);
export const isSecret = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);
export const isGmKey = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128;
export const isPlayerList = (v: unknown): v is PlayerInfo[] =>
  Array.isArray(v) && v.length <= 64 && v.every((p) => isRec(p) && isPlayerId(p.id) && isBool(p.isGM));

// ── Fog memory ───────────────────────────────────────────────────────────

const CELL_RE = /^-?\d{1,6},-?\d{1,6}$/;
const MAX_CELLS = 400_000;

/** Validates a list of explored grid cells ("gx,gy"). */
export function validateCells(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_CELLS) return null;
  for (const c of raw) if (typeof c !== 'string' || !CELL_RE.test(c)) return null;
  return raw as string[];
}
