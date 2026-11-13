import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pack, unpack } from 'peerjs-js-binarypack';

/**
 * Two real NetworkService instances talking through a simulated PeerJS network.
 * Every message goes through PeerJS's actual BinaryPack serializer, so wire quirks
 * (undefined → null, etc.) are exercised, unlike with in-memory fakes.
 */
const { FakePeer, hub } = vi.hoisted(() => {
  type H = (...a: unknown[]) => void;
  class Emitter {
    handlers = new Map<string, H[]>();
    on(ev: string, cb: H) { (this.handlers.get(ev) ?? this.handlers.set(ev, []).get(ev)!).push(cb); }
    emit(ev: string, ...a: unknown[]) { (this.handlers.get(ev) ?? []).forEach((h) => h(...a)); }
  }
  const hub = {
    peers: new Map<string, InstanceType<typeof FakePeer>>(),
    n: 0,
    wire: (m: unknown): unknown => m,
    reset() { this.peers.clear(); this.n = 0; },
  };
  class FakeConn extends Emitter {
    open = false;
    remote!: FakeConn;
    constructor(public peer: string) { super(); }
    send(m: unknown) {
      if (!this.open) return;
      const wire = hub.wire(m);
      queueMicrotask(() => { if (this.remote.open) this.remote.emit('data', wire); });
    }
    close() {
      if (!this.open) return;
      this.open = false;
      queueMicrotask(() => {
        this.emit('close');
        if (this.remote.open) { this.remote.open = false; this.remote.emit('close'); }
      });
    }
  }
  class FakePeer extends Emitter {
    id: string;
    destroyed = false;
    conns: FakeConn[] = [];
    constructor(idOrOptions?: unknown) {
      super();
      // Real PeerJS overloads: Peer(id?, options?) and Peer(options).
      const id = typeof idOrOptions === 'string' ? idOrOptions : undefined;
      this.id = id ?? `anon-${++hub.n}`;
      queueMicrotask(() => {
        if (this.destroyed) return;
        if (id && hub.peers.has(id)) this.emit('error', { type: 'unavailable-id', message: 'ID is taken' });
        else { hub.peers.set(this.id, this); this.emit('open', this.id); }
      });
    }
    connect(id: string) {
      const a = new FakeConn(id);
      queueMicrotask(() => {
        const target = hub.peers.get(id);
        if (!target || target.destroyed || this.destroyed) {
          this.emit('error', { type: 'peer-unavailable', message: `Could not connect to peer ${id}` });
          return;
        }
        const b = new FakeConn(this.id);
        a.remote = b; b.remote = a;
        this.conns.push(a); target.conns.push(b);
        target.emit('connection', b);
        a.open = true; b.open = true;
        b.emit('open'); a.emit('open');
      });
      return a;
    }
    reconnect() {}
    destroy() {
      this.destroyed = true;
      if (hub.peers.get(this.id) === this) hub.peers.delete(this.id);
      for (const c of this.conns) c.close();
      this.conns = [];
    }
  }
  return { FakePeer, hub };
});
vi.mock('peerjs', () => ({ default: FakePeer }));

import { NetworkService } from '@/vtt/network/NetworkService';
import { SceneStore } from '@/vtt/scene/SceneStore';
import { EphemeralStore } from '@/vtt/scene/EphemeralStore';
import type { Identity } from '@/vtt/network/identity';

hub.wire = (m) => unpack(pack(m as never) as ArrayBuffer);

const ROOM = 'room1';
const HOST_ID = `vtt-maker-room-${ROOM}`;
const GM_KEY = 'the-gm-key';
const GM: Identity = { id: 'a1a1a1a1', secret: '1'.repeat(32) };
const PLAYER: Identity = { id: 'b2b2b2b2', secret: '2'.repeat(32) };

type Node = { net: NetworkService; store: SceneStore; eph: EphemeralStore; fog: { cells: string[]; replace: boolean }[]; status: string[] };
function node(identity: Identity, gmKey: string | null): Node {
  const store = new SceneStore();
  const eph = new EphemeralStore();
  const net = new NetworkService({ roomId: ROOM, store, ephemeralStore: eph, identity, gmKey });
  const n: Node = { net, store, eph, fog: [], status: [] };
  net.onStatusChange = (s) => n.status.push(s);
  net.onFogMemory = (cells, replace) => n.fog.push({ cells, replace });
  net.init();
  return n;
}
/** Let microtask-driven delivery and the 30ms push timers run. */
const settle = (ms = 100) => vi.advanceTimersByTimeAsync(ms);
const nodes: Node[] = [];
const spawn = (identity: Identity, gmKey: string | null) => { const n = node(identity, gmKey); nodes.push(n); return n; };

beforeEach(() => {
  vi.useFakeTimers();
  hub.reset();
  try { localStorage.clear(); } catch { /* node env */ }
});
afterEach(() => {
  for (const n of nodes.splice(0)) n.net.destroy();
  vi.useRealTimers();
});

/** A GM host whose map has a wall, and a player token plus a far-away token. */
async function room() {
  const host = spawn(GM, GM_KEY);
  await settle();
  const s = host.store;
  s.addWall({ x1: 400, y1: -3000, x2: 400, y2: 3000 });
  const me = s.addToken({ x: 100, y: 100, visionRadius: 250 })!;
  s.updateToken(me.id, { ownerId: PLAYER.id });
  const far = s.addToken({ x: 1500, y: 100 })!;
  return { host, me, far };
}

describe('client ↔ host over the real wire format', () => {
  it('a player joins and receives only what they may see', async () => {
    const { host, me, far } = await room();
    const player = spawn(PLAYER, null);
    await settle(200);

    expect(host.net.isHost).toBe(true);
    expect(player.net.isHost).toBe(false);
    const ids = player.store.snapshot().tokens.map((t) => t.id);
    expect(ids).toEqual([me.id]);
    expect(ids).not.toContain(far.id);
    expect(player.store.snapshot().walls).toHaveLength(1); // the wall within sight range
    expect(player.fog.at(-1)?.replace).toBe(true);
    expect(player.fog.at(-1)!.cells.length).toBeGreaterThan(0);
  });

  it('an unrelated token appears for the player only when it enters their vision', async () => {
    const { host, far } = await room();
    const player = spawn(PLAYER, null);
    await settle(200);
    host.store.updateToken(far.id, { x: 200, y: 100 });
    await settle(200);
    expect(player.store.snapshot().tokens.map((t) => t.id)).toContain(far.id);
    host.store.updateToken(far.id, { x: 1500, y: 100 });
    await settle(200);
    expect(player.store.snapshot().tokens.map((t) => t.id)).not.toContain(far.id);
  });

  it('a player moving their own token reaches the host', async () => {
    const { host, me } = await room();
    const player = spawn(PLAYER, null);
    await settle(200);
    player.store.updateToken(me.id, { x: 150, y: 120 });
    await settle(200);
    expect(host.store.findTokenById(me.id)).toMatchObject({ x: expect.closeTo(150, 1), y: expect.closeTo(120, 1) });
  });

  it('a player cannot walk through a wall by forging a position, and is snapped back', async () => {
    const { host, me } = await room();
    const player = spawn(PLAYER, null);
    await settle(200);
    player.store.updateToken(me.id, { x: 1000, y: 100 }); // the wall is at x=400
    await settle(300);
    expect(host.store.findTokenById(me.id)!.x).toBeLessThan(400);
    expect(player.store.findTokenById(me.id)!.x).toBeLessThan(400); // resynced to the truth
  });

  it("a player's attempts to change the map are ignored and undone locally", async () => {
    const { host } = await room();
    const player = spawn(PLAYER, null);
    await settle(200);
    const wallId = player.store.snapshot().walls[0].id;
    player.store.removeWall(wallId);
    player.store.updateSceneSettings({ mapWidth: 3 });
    await settle(300);
    expect(host.store.snapshot().walls).toHaveLength(1);
    expect(host.store.snapshot().mapWidth).toBe(40);
    expect(player.store.snapshot().walls).toHaveLength(1);
    expect(player.store.snapshot().mapWidth).toBe(40);
  });

  it('a GM client can edit the map and the host applies it', async () => {
    const { host } = await room();
    const gm2 = spawn({ id: 'c3c3c3c3', secret: '3'.repeat(32) }, GM_KEY);
    await settle(200);
    expect(gm2.net.isHost).toBe(false);
    gm2.store.addWall({ x1: 0, y1: 0, x2: 0, y2: 200 });
    await settle(200);
    expect(host.store.snapshot().walls).toHaveLength(2);
  });

  it('forwards cursors between clients with the real sender id, not a spoofed one', async () => {
    await room();
    const p1 = spawn(PLAYER, null);
    const p2 = spawn({ id: 'd4d4d4d4', secret: '4'.repeat(32) }, null);
    await settle(200);
    p1.net.broadcastEphemeral({ type: 'CURSOR', x: 5, y: 6, color: '#ffffff', name: 'P1' });
    await settle(100);
    const seen = [...p2.eph.cursors.values()];
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ x: 5, y: 6, name: 'P1' });
    expect(seen[0].id).toBe('anon-1'); // p1's transport-assigned peer id (p2 is anon-2)
  });
});

describe('connection loss and recovery', () => {
  it('a player retries with backoff, then reconnects when the GM comes back', async () => {
    const { host } = await room();
    const player = spawn(PLAYER, null);
    await settle(200);
    expect(player.net.connected).toBe(true);

    host.net.destroy();
    await settle(100);
    expect(player.net.connected).toBe(false);
    expect(player.status.some((s) => /Disconnected from Host/.test(s))).toBe(true);

    await settle(5_000); // GM is still away: the player waits, and never claims the room
    expect(hub.peers.has(HOST_ID)).toBe(false);
    expect(player.status.some((s) => /Waiting for the GM/.test(s))).toBe(true);

    const gm = spawn(GM, GM_KEY); // GM returns (fresh page, empty scene)
    await settle(300);
    expect(gm.net.isHost).toBe(true);
    await settle(20_000);
    expect(player.net.connected).toBe(true);
  });

  it('a player never becomes host, even if the room is empty', async () => {
    const lone = spawn(PLAYER, null);
    await settle(30_000);
    expect(lone.net.isHost).toBe(false);
    expect(hub.peers.has(HOST_ID)).toBe(false);
  });

  it('a GM client takes over a vacated room and keeps the scene it had mirrored', async () => {
    const { host, me } = await room();
    const gm2 = spawn({ id: 'c3c3c3c3', secret: '3'.repeat(32) }, GM_KEY);
    await settle(200);
    expect(gm2.store.findTokenById(me.id)).toBeDefined();

    host.net.destroy();
    await settle(20_000);
    expect(gm2.net.isHost).toBe(true);
    expect(gm2.store.findTokenById(me.id)).toBeDefined();
  });
});

describe('abuse protection on the host', () => {
  it('drops a connection that never says hello', async () => {
    await room();
    const raw = new FakePeer();
    await settle();
    const conn = raw.connect(HOST_ID);
    let closed = false;
    conn.on('close', () => { closed = true; });
    await settle(11_000);
    expect(closed).toBe(true);
  });

  it('rate-limits a flood of messages from one connection', async () => {
    const { host } = await room();
    const spy = vi.spyOn(host.eph, 'updateCursor');
    const raw = new FakePeer();
    await settle();
    const conn = raw.connect(HOST_ID);
    await settle();
    conn.send({ type: 'HELLO', playerId: 'e5e5e5e5', secret: '5'.repeat(32) });
    await settle();
    for (let i = 0; i < 2000; i++) conn.send({ type: 'EPHEMERAL', event: { type: 'CURSOR', x: i, y: 0, color: '#ffffff', name: 'x' } });
    await settle(50);
    expect(spy.mock.calls.length).toBeGreaterThan(50);
    expect(spy.mock.calls.length).toBeLessThan(400); // burst of 200 + a trickle, not 2000
  });
});
