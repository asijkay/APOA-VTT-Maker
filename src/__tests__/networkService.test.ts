import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Fake PeerJS: just enough to drive the host code path in-process ─────────
// vi.mock is hoisted above imports, so the fakes must be created with vi.hoisted.
const { FakePeer, FakeConn } = vi.hoisted(() => {
  type Handler = (...a: unknown[]) => void;
  class FakeEmitter {
    handlers = new Map<string, Handler[]>();
    on(ev: string, cb: Handler) { (this.handlers.get(ev) ?? this.handlers.set(ev, []).get(ev)!).push(cb); }
    emit(ev: string, ...a: unknown[]) { (this.handlers.get(ev) ?? []).forEach((h) => h(...a)); }
  }
  class FakeConn extends FakeEmitter {
    open = true;
    sent: Record<string, unknown>[] = [];
    constructor(public peer: string) { super(); }
    send(m: Record<string, unknown>) { this.sent.push(m); }
    receive(m: unknown) { this.emit('data', m); }
  }
  class FakePeer extends FakeEmitter {
    static last: FakePeer;
    id: string;
    constructor(id?: string) { super(); this.id = id ?? 'peer-random'; FakePeer.last = this; queueMicrotask(() => this.emit('open', this.id)); }
    destroy() {}
    connect() { return new FakeConn('host'); }
  }
  return { FakePeer, FakeConn };
});
vi.mock('peerjs', () => ({ default: FakePeer }));

import { NetworkService } from '@/vtt/network/NetworkService';
import { SceneStore } from '@/vtt/scene/SceneStore';
import { EphemeralStore } from '@/vtt/scene/EphemeralStore';

const SECRET_A = 'a'.repeat(32);
const SECRET_B = 'b'.repeat(32);
const ID_A = 'aaaaaaaa';
const GM_KEY = 'gm-secret-key';

async function hostWithStore() {
  const store = new SceneStore();
  const net = new NetworkService({
    roomId: 'r1', store, ephemeralStore: new EphemeralStore(),
    identity: { id: 'ffffffff', secret: 'f'.repeat(32) }, gmKey: GM_KEY,
  });
  net.init();
  await Promise.resolve(); // let the fake 'open' fire
  const connect = (peer: string) => {
    const c = new FakeConn(peer);
    FakePeer.last.emit('connection', c);
    return c;
  };
  return { store, net, connect };
}
const last = (c: InstanceType<typeof FakeConn>, type: string) => [...c.sent].reverse().find((m) => m.type === type);
const flush = () => new Promise((r) => setTimeout(r, 60));

beforeEach(() => { try { localStorage.clear(); } catch { /* node env */ } });

describe('NetworkService (host)', () => {
  it('ignores everything before HELLO', async () => {
    const { store, connect } = await hostWithStore();
    const c = connect('p1');
    c.receive({ type: 'DELTA', delta: { settings: { mapWidth: 5 } } });
    expect(store.snapshot().mapWidth).toBe(40);
    expect(c.sent).toHaveLength(0);
  });

  it('welcomes a player (not GM) and sends them a filtered scene', async () => {
    const { store, connect } = await hostWithStore();
    store.addToken({ x: 10, y: 10 });
    const c = connect('p1');
    c.receive({ type: 'HELLO', playerId: ID_A, secret: SECRET_A });
    expect(last(c, 'WELCOME')).toMatchObject({ isGM: false, playerId: ID_A });
    const sync = last(c, 'SYNC') as { scene: { tokens: unknown[] } };
    expect(sync.scene.tokens).toHaveLength(0); // the unowned token is outside any vision
  });

  it('only grants GM with the right key', async () => {
    const { connect } = await hostWithStore();
    const bad = connect('p1');
    bad.receive({ type: 'HELLO', playerId: ID_A, secret: SECRET_A, gmKey: 'guess' });
    expect(last(bad, 'WELCOME')).toMatchObject({ isGM: false });
    const good = connect('p2');
    good.receive({ type: 'HELLO', playerId: 'bbbbbbbb', secret: SECRET_B, gmKey: GM_KEY });
    expect(last(good, 'WELCOME')).toMatchObject({ isGM: true });
  });

  it("does not let someone take over another player's id", async () => {
    const { connect } = await hostWithStore();
    connect('p1').receive({ type: 'HELLO', playerId: ID_A, secret: SECRET_A });
    const thief = connect('p2');
    thief.receive({ type: 'HELLO', playerId: ID_A, secret: SECRET_B });
    expect(last(thief, 'WELCOME')).toMatchObject({ playerId: null });
    const real = connect('p3'); // same browser reconnecting after refresh
    real.receive({ type: 'HELLO', playerId: ID_A, secret: SECRET_A });
    expect(last(real, 'WELCOME')).toMatchObject({ playerId: ID_A });
  });

  it('applies a player moving their own token and does not echo it back', async () => {
    const { store, connect } = await hostWithStore();
    const t = store.addToken({ x: 10, y: 10 })!;
    store.updateToken(t.id, { ownerId: ID_A });
    const c = connect('p1');
    c.receive({ type: 'HELLO', playerId: ID_A, secret: SECRET_A });
    const sentBefore = c.sent.length;
    const mine = store.findTokenById(t.id)!;
    c.receive({ type: 'DELTA', delta: { upsert: { tokens: [{ ...mine, x: 250 }] } } });
    expect(store.findTokenById(t.id)!.x).toBe(250);
    await flush();
    expect(c.sent.slice(sentBefore).filter((m) => m.type === 'DELTA')).toHaveLength(0);
  });

  it('rejects a forged scene/delta from a player and resyncs them', async () => {
    const { store, connect } = await hostWithStore();
    store.addWall({ x1: 0, y1: 0, x2: 100, y2: 0 });
    const c = connect('p1');
    c.receive({ type: 'HELLO', playerId: ID_A, secret: SECRET_A });
    const syncs = c.sent.filter((m) => m.type === 'SYNC').length;
    const wallId = store.snapshot().walls[0].id;
    c.receive({ type: 'DELTA', delta: { remove: { walls: [wallId] }, settings: { mapWidth: 1 } } });
    c.receive({ type: 'SCENE_SYNC', scene: { evil: true } }); // the old, trusting message type
    expect(store.snapshot().walls).toHaveLength(1);
    expect(store.snapshot().mapWidth).toBe(40);
    expect(c.sent.filter((m) => m.type === 'SYNC').length).toBe(syncs + 1);
  });

  it('survives garbage without throwing', async () => {
    const { connect } = await hostWithStore();
    const c = connect('p1');
    c.receive({ type: 'HELLO', playerId: ID_A, secret: SECRET_A });
    for (const junk of [null, 5, 'x', [], {}, { type: 'DELTA' }, { type: 'DELTA', delta: { upsert: { tokens: 'no' } } }, { type: 'EPHEMERAL', event: { type: 'PING' } }]) {
      expect(() => c.receive(junk)).not.toThrow();
    }
  });

  it("stamps ephemeral events with the sender's real peer id, ignoring a spoofed one", async () => {
    const { connect } = await hostWithStore();
    const a = connect('peer-a');
    a.receive({ type: 'HELLO', playerId: ID_A, secret: SECRET_A });
    const b = connect('peer-b');
    b.receive({ type: 'HELLO', playerId: 'bbbbbbbb', secret: SECRET_B });
    a.receive({ type: 'EPHEMERAL', senderId: 'peer-b', event: { type: 'PING', x: 1, y: 1, color: '#fff' } });
    expect(last(b, 'EPHEMERAL')).toMatchObject({ senderId: 'peer-a' });
  });

  it('pushes only the changed object to a GM, as a delta', async () => {
    const { store, connect } = await hostWithStore();
    for (let i = 0; i < 50; i++) store.addToken({ x: i, y: i });
    const gm = connect('gm');
    gm.receive({ type: 'HELLO', playerId: 'bbbbbbbb', secret: SECRET_B, gmKey: GM_KEY });
    const id = store.snapshot().tokens[3].id;
    store.updateToken(id, { x: 999 });
    await flush();
    const d = last(gm, 'DELTA') as { delta: { upsert: { tokens: unknown[] } } };
    expect(d.delta.upsert.tokens).toHaveLength(1);
  });

  it('never sends a player a token outside their vision, then sends it when it comes into view', async () => {
    const { store, connect } = await hostWithStore();
    const me = store.addToken({ x: 100, y: 100, visionRadius: 300 })!;
    store.updateToken(me.id, { ownerId: ID_A });
    const far = store.addToken({ x: 2000, y: 2000 })!;
    const c = connect('p1');
    c.receive({ type: 'HELLO', playerId: ID_A, secret: SECRET_A });
    expect((last(c, 'SYNC') as { scene: { tokens: { id: string }[] } }).scene.tokens.map((t) => t.id)).toEqual([me.id]);
    store.updateToken(far.id, { x: 150, y: 100 });
    await flush();
    const d = last(c, 'DELTA') as { delta: { upsert: { tokens: { id: string }[] } } };
    expect(d.delta.upsert.tokens.map((t) => t.id)).toEqual([far.id]);
  });
});
