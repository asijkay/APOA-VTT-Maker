/**
 * Stable player identity + GM key, persisted per browser.
 *
 * A PeerJS peer id is random on every page load, so it can't identify a player
 * across refreshes. Instead each browser keeps:
 *  - `id`:     short, public. The GM assigns tokens to it; shown in the UI.
 *  - `secret`: private. Proves that whoever reconnects as `id` is the same browser.
 * The host remembers the first secret it sees for an id and rejects any other.
 */

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type Identity = { id: string; secret: string };

const IDENTITY_KEY = 'vtt-identity-v1';
const gmKeyKey = (roomId: string) => `vtt-gmkey-v1:${roomId}`;
const bindingsKey = (roomId: string) => `vtt-bindings-v1:${roomId}`;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function randomToken(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function read(storage: StorageLike | null, key: string): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}
function write(storage: StorageLike | null, key: string, value: string): void {
  try { storage?.setItem(key, value); } catch { /* private mode / quota: identity just won't persist */ }
}

export function loadIdentity(storage: StorageLike | null = defaultStorage()): Identity {
  const raw = read(storage, IDENTITY_KEY);
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<Identity>;
      if (typeof p.id === 'string' && typeof p.secret === 'string' && p.id && p.secret) {
        return { id: p.id, secret: p.secret };
      }
    } catch { /* fall through and mint a new one */ }
  }
  const fresh: Identity = { id: randomToken(4), secret: randomToken(16) };
  write(storage, IDENTITY_KEY, JSON.stringify(fresh));
  return fresh;
}

/**
 * Resolves the GM key for a room.
 *  - key in the URL wins (and is remembered)
 *  - else a remembered key
 *  - else, only if this browser is creating a GM session, a fresh key
 *  - else null (a plain player never holds a key)
 */
export function resolveGmKey(
  roomId: string,
  urlKey: string | null,
  wantsGM: boolean,
  storage: StorageLike | null = defaultStorage(),
): string | null {
  if (urlKey && urlKey.length <= 128) {
    write(storage, gmKeyKey(roomId), urlKey);
    return urlKey;
  }
  const stored = read(storage, gmKeyKey(roomId));
  if (stored) return stored;
  if (!wantsGM) return null;
  const fresh = randomToken(16);
  write(storage, gmKeyKey(roomId), fresh);
  return fresh;
}

export function loadBindings(roomId: string, storage: StorageLike | null = defaultStorage()): Record<string, string> {
  try {
    const parsed = JSON.parse(read(storage, bindingsKey(roomId)) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveBindings(
  roomId: string,
  bindings: Record<string, string>,
  storage: StorageLike | null = defaultStorage(),
): void {
  write(storage, bindingsKey(roomId), JSON.stringify(bindings));
}

/** Constant-time-ish string compare so secret checks don't leak length-prefix timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Host-side per-room fog memory ────────────────────────────────────────

const fogKey = (roomId: string) => `vtt-fog-v1:${roomId}`;
const MAX_STORED_CELLS = 150_000; // keeps the stored JSON comfortably inside the localStorage quota

/** Cells each player has explored, keyed by player id. Survives the host reloading. */
export function loadFog(roomId: string, storage: StorageLike | null = defaultStorage()): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  try {
    const parsed = JSON.parse(read(storage, fogKey(roomId)) ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [id, cells] of Object.entries(parsed)) {
        if (Array.isArray(cells)) out.set(id, new Set(cells.filter((c): c is string => typeof c === 'string')));
      }
    }
  } catch { /* corrupt: start with no memory */ }
  return out;
}

export function saveFog(
  roomId: string,
  fog: Map<string, Set<string>>,
  storage: StorageLike | null = defaultStorage(),
): void {
  const obj: Record<string, string[]> = {};
  let budget = MAX_STORED_CELLS;
  for (const [id, cells] of fog) {
    const list = Array.from(cells).slice(0, Math.max(0, budget));
    budget -= list.length;
    obj[id] = list;
  }
  write(storage, fogKey(roomId), JSON.stringify(obj));
}
