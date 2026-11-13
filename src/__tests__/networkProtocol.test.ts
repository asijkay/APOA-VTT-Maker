import { describe, it, expect } from 'vitest';
import { createEmptyScene, type Scene, type Token } from '@/vtt/scene/SceneTypes';
import {
  applyDelta, authorizeDelta, diffScenes, isEmptyDelta, validateCells, validateDelta, validateEphemeral, validateScene,
} from '@/vtt/network/protocol';
import { createMemory, filterSceneForViewer } from '@/vtt/network/viewFilter';
import { loadFog, loadIdentity, resolveGmKey, safeEqual, saveFog, type StorageLike } from '@/vtt/network/identity';
import { getPeerOptions, parseIceServers } from '@/vtt/network/peerOptions';
import { moveCircleSwept } from '@/vtt/geometry/collision';
import { SceneStore } from '@/vtt/scene/SceneStore';
import { storageKeyFor } from '@/vtt/scene/PersistenceService';

const tok = (over: Partial<Token> = {}): Token => ({
  id: 't1', x: 100, y: 100, elevation: 0, radius: 20, visionRadius: 300, ...over,
});
const scene = (over: Partial<Scene> = {}): Scene => ({ ...createEmptyScene(), ...over });
const memStorage = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('validateScene / validateDelta', () => {
  it('accepts a well-formed scene and drops unknown fields', () => {
    const s = scene({ tokens: [tok()] });
    const raw = JSON.parse(JSON.stringify(s));
    raw.tokens[0].evil = 'x';
    const out = validateScene(raw)!;
    expect(out.tokens[0]).toEqual(tok());
    expect('evil' in out.tokens[0]).toBe(false);
  });

  it.each([
    ['null', null],
    ['non-finite number', { ...scene(), tokens: [tok({ x: Infinity })] }],
    ['NaN', { ...scene(), tokens: [tok({ y: NaN })] }],
    ['bad light color', { ...scene(), lights: [{ id: 'l', x: 0, y: 0, elevation: 0, radius: 5, color: 'red', enabled: true }] }],
    ['javascript: image url', { ...scene(), tokens: [tok({ imageUrl: 'javascript:alert(1)' })] }],
    ['duplicate ids', { ...scene(), tokens: [tok(), tok()] }],
    ['array too large for collection', { ...scene(), lights: Array.from({ length: 501 }, (_, i) => ({ id: `l${i}`, x: 0, y: 0, elevation: 0, radius: 5, color: '#fff', enabled: true })) }],
    ['missing collection', (() => { const s: Record<string, unknown> = { ...scene() }; delete s.walls; return s; })()],
    ['absurd grid size', { ...scene(), gridSize: 1e9 }],
  ])('rejects %s', (_name, raw) => {
    expect(validateScene(raw)).toBeNull();
  });

  it('rejects malformed deltas', () => {
    expect(validateDelta('x')).toBeNull();
    expect(validateDelta({ upsert: { tokens: [{ id: 't' }] } })).toBeNull();
    expect(validateDelta({ remove: { tokens: [1] } })).toBeNull();
    expect(validateDelta({ settings: { ambientLightColor: 'javascript:' } })).toBeNull();
    expect(validateDelta({ upsert: 'nope' })).toBeNull();
  });

  it('accepts a data-URL portrait', () => {
    const t = tok({ imageUrl: 'data:image/png;base64,AAAA' });
    expect(validateDelta({ upsert: { tokens: [t] } })).not.toBeNull();
  });
});

describe('diffScenes / applyDelta', () => {
  it('round-trips adds, updates, removals and settings', () => {
    const a = scene({ tokens: [tok({ id: 'a' }), tok({ id: 'b' })], mapWidth: 40 });
    const b = scene({ tokens: [tok({ id: 'a', x: 500 }), tok({ id: 'c' })], mapWidth: 60 });
    const d = diffScenes(a, b);
    expect(d.upsert?.tokens?.map((t) => t.id).sort()).toEqual(['a', 'c']);
    expect(d.remove?.tokens).toEqual(['b']);
    expect(d.settings).toEqual({ mapWidth: 60 });
    const out = applyDelta(a, d);
    expect(out.tokens.map((t) => t.id).sort()).toEqual(['a', 'c']);
    expect(out.tokens.find((t) => t.id === 'a')!.x).toBe(500);
    expect(out.mapWidth).toBe(60);
  });

  it('is empty when nothing changed, and treats undefined fields as absent', () => {
    const a = scene({ tokens: [{ ...tok(), imageUrl: undefined }] });
    const b = scene({ tokens: [tok()] });
    expect(isEmptyDelta(diffScenes(a, b))).toBe(true);
  });

  it('only carries the objects that changed (not the whole scene)', () => {
    const many = Array.from({ length: 200 }, (_, i) => tok({ id: `t${i}` }));
    const a = scene({ tokens: many });
    const b = scene({ tokens: many.map((t, i) => (i === 7 ? { ...t, x: 1 } : t)) });
    expect(diffScenes(a, b).upsert?.tokens).toHaveLength(1);
  });

  it('does not mutate its input', () => {
    const a = scene({ tokens: [tok()] });
    const frozen = JSON.stringify(a);
    applyDelta(a, { remove: { tokens: ['t1'] } });
    expect(JSON.stringify(a)).toBe(frozen);
  });
});

describe('authorizeDelta', () => {
  const base = scene({ tokens: [tok({ id: 'mine', ownerId: 'aaaaaaaa' }), tok({ id: 'theirs', ownerId: 'bbbbbbbb' })] });
  const me = { isGM: false, playerId: 'aaaaaaaa' };

  it('lets a player move their own token', () => {
    const r = authorizeDelta({ upsert: { tokens: [tok({ id: 'mine', ownerId: 'aaaaaaaa', x: 999 })] } }, base, me);
    expect(r.trimmed).toBe(false);
    expect(r.delta.upsert?.tokens?.[0].x).toBeCloseTo(999, 3);
  });

  it("refuses to move someone else's token", () => {
    const r = authorizeDelta({ upsert: { tokens: [tok({ id: 'theirs', ownerId: 'bbbbbbbb', x: 1 })] } }, base, me);
    expect(isEmptyDelta(r.delta)).toBe(true);
    expect(r.trimmed).toBe(true);
  });

  it('keeps only x/y when a player also tries to take ownership or boost vision', () => {
    const r = authorizeDelta({ upsert: { tokens: [tok({ id: 'mine', ownerId: 'aaaaaaaa', x: 5, visionRadius: 99999 })] } }, base, me);
    const t = r.delta.upsert!.tokens![0];
    expect(t.x).toBe(5);
    expect(t.visionRadius).toBe(300);
    expect(r.trimmed).toBe(true);
  });

  it('refuses a player stealing an unowned token by setting ownerId', () => {
    const s = scene({ tokens: [tok({ id: 'free' })] });
    const r = authorizeDelta({ upsert: { tokens: [tok({ id: 'free', ownerId: 'aaaaaaaa' })] } }, s, me);
    expect(isEmptyDelta(r.delta)).toBe(true);
  });

  it('refuses everything else from a player: walls, removals, settings, new tokens', () => {
    const r = authorizeDelta({
      upsert: { walls: [{ id: 'w', x1: 0, y1: 0, x2: 1, y2: 0, elevation: 0, blocksVision: true, blocksMovement: true }], tokens: [tok({ id: 'new', ownerId: 'aaaaaaaa' })] },
      remove: { tokens: ['mine'] },
      settings: { mapWidth: 1 },
    }, base, me);
    expect(isEmptyDelta(r.delta)).toBe(true);
    expect(r.trimmed).toBe(true);
  });

  it('gives an unidentified spectator no powers', () => {
    const r = authorizeDelta({ upsert: { tokens: [tok({ id: 'mine', ownerId: 'aaaaaaaa', x: 9 })] } }, base, { isGM: false, playerId: null });
    expect(isEmptyDelta(r.delta)).toBe(true);
  });

  describe('movement guard', () => {
    const wall = { id: 'w', x1: 300, y1: -2000, x2: 300, y2: 3000, elevation: 0, blocksVision: true, blocksMovement: true };
    const room = scene({ walls: [wall], tokens: [tok({ id: 'mine', ownerId: 'aaaaaaaa', x: 100, y: 100, radius: 20 })] });
    const move = (x: number, y: number, s = room) =>
      authorizeDelta({ upsert: { tokens: [tok({ id: 'mine', ownerId: 'aaaaaaaa', x, y, radius: 20 })] } }, s, me);

    it('stops a forged teleport through a wall at the wall', () => {
      const r = move(1500, 100);
      const t = r.delta.upsert!.tokens![0];
      expect(t.x).toBeLessThan(300);
      expect(t.x).toBeGreaterThan(200);
      expect(r.trimmed).toBe(true); // big correction => make the sender resync
    });

    it('lets a normal move on the same side of the wall through untouched', () => {
      const r = move(250, 100);
      expect(r.delta.upsert!.tokens![0].x).toBeCloseTo(250, 3);
      expect(r.trimmed).toBe(false);
    });

    it('does not let a closed door be walked through, but an open one can be', () => {
      const door = (state: 'open' | 'closed') => scene({
        walls: [wall],
        doors: [{ id: 'd', wallId: 'w', position: (100 + 2000) / 5000, width: 120, state, locked: false, hidden: false }],
        tokens: room.tokens,
      });
      expect(move(500, 100, door('closed')).delta.upsert!.tokens![0].x).toBeLessThan(300);
      expect(move(500, 100, door('open')).delta.upsert!.tokens![0].x).toBeCloseTo(500, 3);
    });

    it('clamps a move to the map', () => {
      const t = move(-9999, 99999).delta.upsert!.tokens![0];
      expect(t.x).toBeGreaterThanOrEqual(-1e-6);
      expect(t.y).toBeLessThanOrEqual(room.mapHeight * room.gridSize + 1);
    });
  });

  it('lets the GM do anything', () => {
    const d = { remove: { tokens: ['mine'] }, settings: { mapWidth: 12 } };
    const r = authorizeDelta(d, base, { isGM: true, playerId: null });
    expect(r.delta).toBe(d);
    expect(r.trimmed).toBe(false);
  });
});

describe('filterSceneForViewer', () => {
  const wall = { id: 'w', x1: 200, y1: -500, x2: 200, y2: 500, elevation: 0, blocksVision: true, blocksMovement: true };
  const s = scene({
    walls: [wall],
    tokens: [
      tok({ id: 'me', x: 100, y: 0, ownerId: 'aaaaaaaa' }),
      tok({ id: 'near', x: 150, y: 0, ownerId: 'bbbbbbbb' }),
      tok({ id: 'behindWall', x: 300, y: 0 }),
      tok({ id: 'secret', x: 120, y: 20, hidden: true }),
    ],
    doors: [
      { id: 'd1', wallId: 'w', position: 0.3, width: 50, state: 'closed', locked: false, hidden: false },
      { id: 'd2', wallId: 'w', position: 0.7, width: 50, state: 'open', locked: false, hidden: true },
    ],
  });
  const viewer = { isGM: false, playerId: 'aaaaaaaa' };

  it('gives the GM everything', () => {
    expect(filterSceneForViewer(s, { isGM: true, playerId: null })).toBe(s);
  });

  it('removes tokens behind a wall and hidden tokens, but keeps own and visible ones', () => {
    const ids = filterSceneForViewer(s, viewer).tokens.map((t) => t.id).sort();
    expect(ids).toEqual(['me', 'near']);
  });

  it("never reveals other players' ids", () => {
    const near = filterSceneForViewer(s, viewer).tokens.find((t) => t.id === 'near')!;
    expect(near.ownerId).toBeUndefined();
    expect(filterSceneForViewer(s, viewer).tokens.find((t) => t.id === 'me')!.ownerId).toBe('aaaaaaaa');
  });

  it('removes secret doors', () => {
    expect(filterSceneForViewer(s, viewer).doors.map((d) => d.id)).toEqual(['d1']);
  });

  it('shows a player with no tokens no other tokens at all', () => {
    expect(filterSceneForViewer(s, { isGM: false, playerId: 'cccccccc' }).tokens).toEqual([]);
  });

  it('does not mutate the authoritative scene', () => {
    const before = JSON.stringify(s);
    filterSceneForViewer(s, viewer);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('ephemeral validation', () => {
  it('accepts known events and rejects junk', () => {
    expect(validateEphemeral({ type: 'PING', x: 1, y: 2, color: '#ef4444' })).not.toBeNull();
    expect(validateEphemeral({ type: 'RULER_REMOVE' })).not.toBeNull();
    expect(validateEphemeral({ type: 'PING', x: 1, y: 2, color: 'url(x)' })).toBeNull();
    expect(validateEphemeral({ type: 'CURSOR', x: NaN, y: 0, color: '#fff', name: 'a' })).toBeNull();
    expect(validateEphemeral({ type: 'CURSOR', x: 0, y: 0, color: '#fff', name: 'x'.repeat(500) })).toBeNull();
    expect(validateEphemeral({ type: 'NOPE' })).toBeNull();
    expect(validateEphemeral(undefined)).toBeNull();
  });
});

describe('identity', () => {
  it('keeps the same id across reloads', () => {
    const st = memStorage();
    const a = loadIdentity(st);
    expect(loadIdentity(st)).toEqual(a);
    expect(a.id).toMatch(/^[0-9a-f]{8}$/);
    expect(a.secret).toMatch(/^[0-9a-f]{32}$/);
  });

  it('recovers from corrupt storage and works with no storage at all', () => {
    const st = memStorage();
    st.setItem('vtt-identity-v1', '{oops');
    expect(loadIdentity(st).id).toMatch(/^[0-9a-f]{8}$/);
    expect(loadIdentity(null).id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('GM key: URL wins and is remembered; a plain player never gets one', () => {
    const st = memStorage();
    expect(resolveGmKey('room', null, false, st)).toBeNull();
    const made = resolveGmKey('room', null, true, st);
    expect(made).toMatch(/^[0-9a-f]{32}$/);
    expect(resolveGmKey('room', null, false, st)).toBe(made);
    expect(resolveGmKey('room', 'fromUrl', false, st)).toBe('fromUrl');
    expect(resolveGmKey('room', null, false, st)).toBe('fromUrl');
    expect(resolveGmKey('other', null, false, st)).toBeNull();
  });

  it('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('persistence key + store revision', () => {
  it('scopes autosave per room', () => {
    expect(storageKeyFor('abc')).not.toBe(storageKeyFor('xyz'));
    expect(storageKeyFor('abc')).toContain('abc');
  });

  it('bumps revision on mutation, and peek() does not copy', () => {
    const store = new SceneStore();
    const r0 = store.getRevision();
    store.addToken({ x: 1, y: 1 });
    expect(store.getRevision()).toBeGreaterThan(r0);
    expect(store.peek()).toBe(store.peek());
    expect(store.snapshot()).not.toBe(store.peek());
  });

  it('only deep-copies for listeners that read change.scene', () => {
    const store = new SceneStore();
    let reads = 0;
    const orig = store.snapshot.bind(store);
    store.snapshot = () => { reads += 1; return orig(); };
    store.subscribe(() => { /* ignores change.scene */ });
    store.addToken({ x: 1, y: 1 });
    expect(reads).toBe(0);
    store.subscribe((c) => void c.scene);
    store.addToken({ x: 2, y: 2 });
    expect(reads).toBe(1);
  });
});

describe('real PeerJS wire format', () => {
  // PeerJS serializes with BinaryPack, which turns `undefined` into `null`.
  // A scene that validates in memory must still validate after a real round trip.
  it('validates a scene after BinaryPack serialization (undefined → null)', async () => {
    const { pack, unpack } = await import('peerjs-js-binarypack');
    const store = new SceneStore();
    const t = store.addToken({ x: 5, y: 5 })!; // imageUrl: undefined, ownerId: undefined
    store.addWall({ x1: 0, y1: 0, x2: 0, y2: 100 });
    store.addDoor({ wallId: store.snapshot().walls[0].id, position: 0.5 });
    const original = store.snapshot();
    original.ambientLightLevel = undefined; // unset optional scene setting
    expect('imageUrl' in original.tokens[0]).toBe(true); // the premise: the store really does hold undefined
    const wire = unpack(pack({ type: 'SYNC', scene: original }) as ArrayBuffer) as { scene: unknown };
    const out = validateScene(wire.scene);
    expect(out).not.toBeNull();
    expect(out!.tokens[0].id).toBe(t.id);
    expect(out!.tokens[0].imageUrl).toBeUndefined();
  });

  it('validates a delta after BinaryPack serialization', async () => {
    const { pack, unpack } = await import('peerjs-js-binarypack');
    const store = new SceneStore();
    store.addToken({ x: 5, y: 5 });
    const delta = diffScenes(createEmptyScene(), store.snapshot());
    const wire = unpack(pack({ type: 'DELTA', delta }) as ArrayBuffer) as { delta: unknown };
    expect(validateDelta(wire.delta)).not.toBeNull();
  });
});

describe('layout filtering (what a player is never sent)', () => {
  const wallAt = (id: string, x1: number, y1: number, x2: number, y2: number) =>
    ({ id, x1, y1, x2, y2, elevation: 0, blocksVision: true, blocksMovement: true });
  const world = () => scene({
    walls: [wallAt('near', 200, -100, 200, 100), wallAt('far', 3000, 0, 3000, 400)],
    floors: [
      { id: 'f-near', gridX: 2, gridY: 0, elevation: 0 },
      { id: 'f-far', gridX: 50, gridY: 50, elevation: 0 },
    ],
    lights: [
      { id: 'l-near', x: 150, y: 50, elevation: 0, radius: 100, color: '#ffffff', enabled: true },
      { id: 'l-far', x: 3000, y: 3000, elevation: 0, radius: 100, color: '#ffffff', enabled: true },
    ],
    doors: [
      { id: 'd-near', wallId: 'near', position: 0.5, width: 40, state: 'closed', locked: false, hidden: false },
      { id: 'd-far', wallId: 'far', position: 0.5, width: 40, state: 'closed', locked: false, hidden: false },
    ],
    windows: [{ id: 'w-far', wallId: 'far', position: 0.2, width: 30 }],
    images: [
      { id: 'img-near', url: 'data:image/png;base64,AAAA', x: 100, y: 0, width: 200, height: 200, opacity: 1, locked: true },
      { id: 'img-far', url: 'data:image/png;base64,AAAA', x: 3000, y: 3000, width: 200, height: 200, opacity: 1, locked: true },
    ],
    tokens: [tok({ id: 'me', x: 100, y: 0, ownerId: 'aaaaaaaa', visionRadius: 250 })],
  });
  const viewer = { isGM: false, playerId: 'aaaaaaaa' };
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();

  it('sends only layout near the player and withholds everything far away', () => {
    const v = filterSceneForViewer(world(), viewer, createMemory());
    expect(ids(v.walls)).toEqual(['near']);
    expect(ids(v.floors)).toEqual(['f-near']);
    expect(ids(v.lights)).toEqual(['l-near']);
    expect(ids(v.doors)).toEqual(['d-near']);
    expect(v.windows).toEqual([]);
    expect(ids(v.images)).toEqual(['img-near']);
  });

  it('keeps sending explored areas after the player walks away (fog memory)', () => {
    const memory = createMemory();
    filterSceneForViewer(world(), viewer, memory);
    const moved = world();
    moved.tokens[0] = { ...moved.tokens[0], x: 3000, y: 200 };
    const v = filterSceneForViewer(moved, viewer, memory);
    expect(ids(v.walls)).toEqual(['far', 'near']); // 'far' is now in sight, 'near' is remembered
    expect(ids(v.floors)).toContain('f-near');
  });

  it('reports newly explored cells exactly once', () => {
    const memory = createMemory();
    filterSceneForViewer(world(), viewer, memory);
    expect(memory.added.length).toBeGreaterThan(0);
    expect(new Set(memory.added).size).toBe(memory.added.length);
    memory.added = [];
    filterSceneForViewer(world(), viewer, memory);
    expect(memory.added).toEqual([]);
  });

  it('includes every wall within sight range, so the client\'s own line-of-sight is exact', () => {
    const w = scene({ walls: [wallAt('edge', 100 + 249, -500, 100 + 249, 500)], tokens: [tok({ id: 'me', x: 100, y: 0, ownerId: 'aaaaaaaa', visionRadius: 250 })] });
    expect(ids(filterSceneForViewer(w, viewer, createMemory()).walls)).toEqual(['edge']);
  });

  it('gives a spectator (no tokens) no layout at all', () => {
    const v = filterSceneForViewer(world(), { isGM: false, playerId: null }, createMemory());
    expect([v.walls, v.floors, v.lights, v.doors, v.images].every((l) => l.length === 0)).toBe(true);
  });
});

describe('moveCircleSwept', () => {
  const wall = { id: 'w', x1: 500, y1: -5000, x2: 500, y2: 5000, elevation: 0, blocksVision: true, blocksMovement: true };
  const s = scene({ walls: [wall] });

  it('cannot tunnel through a wall however far the move is', () => {
    for (const far of [600, 2000, 50_000, 1e9]) {
      const end = moveCircleSwept({ x: 100, y: 0 }, { x: far, y: 0 }, 10, s);
      expect(end.x).toBeLessThan(500);
    }
  });

  it('slides along a wall instead of stopping dead', () => {
    const end = moveCircleSwept({ x: 100, y: 0 }, { x: 700, y: 300 }, 10, s);
    expect(end.x).toBeLessThan(500);
    expect(end.y).toBeGreaterThan(100);
  });

  it('is a no-op for a zero-length move in open space', () => {
    expect(moveCircleSwept({ x: 100, y: 100 }, { x: 100, y: 100 }, 10, s)).toEqual({ x: 100, y: 100 });
  });
});

describe('host-side fog storage and ICE options', () => {
  it('round-trips explored cells per player and survives corrupt data', () => {
    const st = memStorage();
    saveFog('room', new Map([['aaaaaaaa', new Set(['1,2', '3,4'])], ['bbbbbbbb', new Set(['9,9'])]]), st);
    const loaded = loadFog('room', st);
    expect([...loaded.get('aaaaaaaa')!].sort()).toEqual(['1,2', '3,4']);
    expect([...loaded.get('bbbbbbbb')!]).toEqual(['9,9']);
    st.setItem('vtt-fog-v1:room', '{nope');
    expect(loadFog('room', st).size).toBe(0);
    expect(loadFog('other', st).size).toBe(0);
  });

  it('validates cell lists', () => {
    expect(validateCells(['1,2', '-3,4'])).toEqual(['1,2', '-3,4']);
    expect(validateCells(['x'])).toBeNull();
    expect(validateCells('1,2')).toBeNull();
    expect(validateCells([1, 2])).toBeNull();
  });

  it('parses ICE servers and ignores junk', () => {
    expect(parseIceServers(undefined)).toBeNull();
    expect(parseIceServers('not json')).toBeNull();
    expect(parseIceServers('[]')).toBeNull();
    expect(parseIceServers('[{"nope":1}]')).toBeNull();
    const ok = '[{"urls":"stun:s.example:3478"},{"urls":["turn:t.example:3478"],"username":"u","credential":"c"}]';
    expect(parseIceServers(ok)).toHaveLength(2);
    expect(getPeerOptions(ok).config?.iceServers).toHaveLength(2);
    expect(getPeerOptions(undefined)).toEqual({});
  });
});
