import Peer, { DataConnection } from 'peerjs';
import type { SceneStore } from '../scene/SceneStore';
import type { EphemeralStore } from '../scene/EphemeralStore';
import type { Scene } from '../scene/SceneTypes';
import {
  applyDelta, authorizeDelta, diffScenes, isEmptyDelta, isGmKey, isPlayerId, isPlayerList, isSecret,
  validateCells, validateDelta, validateEphemeral, validateScene,
  type Delta, type EphemeralEvent, type PlayerInfo, type Viewer,
} from './protocol';
import { createMemory, filterSceneForViewer, type ViewerMemory } from './viewFilter';
import { loadBindings, loadFog, safeEqual, saveBindings, saveFog, type Identity } from './identity';
import { getPeerOptions } from './peerOptions';

/**
 * Host-authoritative multiplayer over PeerJS.
 *
 * The first GM browser to claim `vtt-maker-room-<id>` is the host and owns the truth.
 * Everyone else is a client. Clients never overwrite the host's scene: they send
 * deltas, and the host decides what to accept (see `authorizeDelta`). Each client is
 * only sent what it is allowed to see (see `filterSceneForViewer`).
 *
 *   client → host   HELLO {playerId, secret, gmKey?}
 *   host → client   WELCOME {isGM, playerId|null}  then  SYNC {scene, fog}  (filtered for that viewer)
 *   either way      DELTA {delta}                  (host→client filtered; client→host authorized)
 *   host → client   FOG {add}                      (newly explored cells)
 *   host → GMs      PLAYERS {players}
 *   either way      EPHEMERAL {event}              (cursor/ping/ruler; sender id stamped by host)
 *
 * Resilience: clients retry with backoff when the host goes away. A client that holds
 * the GM key and finds the room vacated takes over as host with the last scene it saw.
 * A player (no key) never claims the room, so a stranger can't become host of a GM's room.
 */

const FLUSH_MS = 30;
const HELLO_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 10_000;
const FOG_SAVE_MS = 2_000;
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 15_000;
// Per-connection rate limit (token bucket). Normal play is well under this.
const RATE_BURST = 200;
const RATE_PER_SEC = 100;
const RATE_KICK_AFTER_DROPS = 2_000;

type Viewing = Viewer & {
  /** What this client was last told, so the next push is a minimal diff. */
  lastSent: Scene | null;
  ready: boolean;
  memory: ViewerMemory;
};

type Bucket = { tokens: number; last: number; dropped: number };

export type NetworkOptions = {
  roomId: string;
  store: SceneStore;
  ephemeralStore: EphemeralStore;
  identity: Identity;
  /** The key proving GM rights. Host: the room's real key. Client: the key it will present. */
  gmKey: string | null;
};

export type RoleInfo = { isHost: boolean; isGM: boolean; playerId: string | null };

export class NetworkService {
  peer: Peer | null = null;
  isHost = false;
  connected = false;

  onStatusChange: ((status: string) => void) | null = null;
  onRoleChange: ((role: RoleInfo) => void) | null = null;
  onPlayersChange: ((players: PlayerInfo[]) => void) | null = null;
  /** Cells this player has explored, as remembered by the host. `replace` on a fresh SYNC. */
  onFogMemory: ((cells: string[], replace: boolean) => void) | null = null;

  private readonly roomId: string;
  private readonly hostId: string;
  private readonly store: SceneStore;
  private readonly ephemeralStore: EphemeralStore;
  private readonly identity: Identity;
  private readonly gmKey: string | null;
  /** Only a holder of the GM key may host. Players just join (and wait for the GM). */
  private readonly canHost: boolean;

  // Host state
  private viewers = new Map<DataConnection, Viewing>();
  private buckets = new WeakMap<DataConnection, Bucket>();
  private bindings: Record<string, string>;
  private fogByPlayer: Map<string, Set<string>>;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private fogSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // Client state
  private hostConn: DataConnection | null = null;
  private clientReady = false;
  private lastSynced: Scene | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  // Connection management
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  private destroyed = false;

  constructor(opts: NetworkOptions) {
    this.roomId = opts.roomId;
    this.hostId = `vtt-maker-room-${opts.roomId}`;
    this.store = opts.store;
    this.ephemeralStore = opts.ephemeralStore;
    this.identity = opts.identity;
    this.gmKey = opts.gmKey;
    this.canHost = opts.gmKey !== null;
    this.bindings = loadBindings(opts.roomId);
    this.fogByPlayer = loadFog(opts.roomId);
  }

  private status(status: string) {
    this.onStatusChange?.(status);
  }

  init() {
    this.status('Initializing connection...');
    this.unsubscribe = this.store.subscribe((_change, source) => {
      if (this.isHost) this.schedulePush();
      else if (source === 'local') this.scheduleFlush();
    });
    this.connect();
  }

  // ── Connection lifecycle ───────────────────────────────────────────────

  private connect() {
    if (this.destroyed) return;
    this.teardownPeer();
    if (this.canHost) this.tryHost();
    else this.tryJoin();
  }

  private teardownPeer() {
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    const wasHost = this.isHost;
    this.isHost = false;
    this.connected = false;
    this.clientReady = false;
    this.lastSynced = null;
    this.hostConn = null;
    if (wasHost) for (const conn of this.viewers.keys()) conn.close();
    this.viewers.clear();
    const old = this.peer;
    this.peer = null;
    old?.destroy();
  }

  private scheduleRetry(reason: string) {
    if (this.destroyed || this.retryTimer) return;
    this.connected = false;
    this.attempt += 1;
    const delay = Math.min(RETRY_BASE_MS * 2 ** (this.attempt - 1), RETRY_MAX_MS) + Math.random() * 300;
    this.status(`${reason} Retrying in ${Math.ceil(delay / 1000)}s…`);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private tryHost() {
    const peer = new Peer(this.hostId, getPeerOptions());
    this.peer = peer;

    peer.on('open', () => {
      if (this.peer !== peer) return;
      this.attempt = 0;
      this.isHost = true;
      this.connected = true;
      this.status('Host (Waiting for players...)');
      this.onRoleChange?.({ isHost: true, isGM: true, playerId: this.identity.id });
      peer.on('connection', (conn) => this.acceptClient(conn));
    });

    // The signalling socket dropped (e.g. a throttled background tab). Re-register the same id.
    peer.on('disconnected', () => {
      if (this.peer !== peer || this.destroyed) return;
      this.status('Lost contact with the signalling server, reconnecting…');
      try { peer.reconnect(); } catch { this.scheduleRetry('Signalling error.'); }
    });

    peer.on('error', (err) => {
      if (this.peer !== peer) return;
      if (err.type === 'unavailable-id') {
        this.status('Room exists, joining…');
        this.teardownPeer();
        this.tryJoin();
      } else {
        this.scheduleRetry(`Error: ${err.message}.`);
      }
    });
  }

  private tryJoin() {
    const peer = new Peer(getPeerOptions());
    this.peer = peer;

    peer.on('error', (err) => {
      if (this.peer !== peer) return;
      if (err.type === 'peer-unavailable') {
        // Nobody is hosting. A GM will take the room over on the next attempt; a player waits for one.
        this.scheduleRetry(this.canHost ? 'Host not found.' : 'Waiting for the GM to open this room.');
      } else {
        this.scheduleRetry(`Error: ${err.message}.`);
      }
    });

    peer.on('open', () => {
      if (this.peer !== peer) return;
      const conn = peer.connect(this.hostId, { reliable: true });
      this.hostConn = conn;

      this.connectTimer = setTimeout(() => {
        if (this.hostConn === conn && !conn.open) this.scheduleRetry('Could not reach the host.');
      }, CONNECT_TIMEOUT_MS);

      conn.on('open', () => {
        if (this.hostConn !== conn) return;
        if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
        this.attempt = 0;
        this.connected = true;
        this.status('Connected to Host');
        conn.send({
          type: 'HELLO',
          playerId: this.identity.id,
          secret: this.identity.secret,
          ...(this.gmKey ? { gmKey: this.gmKey } : {}),
        });
      });
      conn.on('data', (raw) => { if (this.hostConn === conn) this.onHostMessage(raw); });
      const lost = () => {
        if (this.hostConn !== conn) return;
        this.clientReady = false;
        this.scheduleRetry('Disconnected from Host.');
      };
      conn.on('close', lost);
      conn.on('error', lost);
    });
  }

  // ── Client side ────────────────────────────────────────────────────────

  private onHostMessage(raw: unknown) {
    if (typeof raw !== 'object' || raw === null) return;
    const msg = raw as Record<string, unknown>;

    switch (msg.type) {
      case 'WELCOME': {
        const isGM = msg.isGM === true;
        const playerId = isPlayerId(msg.playerId) ? msg.playerId : null;
        this.onRoleChange?.({ isHost: false, isGM, playerId });
        break;
      }
      case 'SYNC': {
        const scene = validateScene(msg.scene);
        if (!scene) { console.warn('[NetworkService] rejected invalid SYNC from host'); return; }
        const fog = msg.fog === undefined ? [] : validateCells(msg.fog);
        this.flushNow();
        this.store.replace(scene, 'network');
        this.lastSynced = this.store.snapshot();
        this.clientReady = true;
        if (fog) this.onFogMemory?.(fog, true);
        break;
      }
      case 'DELTA': {
        const delta = validateDelta(msg.delta);
        if (!delta) { console.warn('[NetworkService] rejected invalid DELTA from host'); return; }
        if (!this.clientReady) return;
        this.flushNow(); // our own pending edits go out before the host's change lands
        const next = applyDelta(this.store.snapshot(), delta);
        this.store.replace(next, 'network');
        this.lastSynced = this.store.snapshot();
        break;
      }
      case 'FOG': {
        const add = validateCells(msg.add);
        if (add) this.onFogMemory?.(add, false);
        break;
      }
      case 'PLAYERS':
        if (isPlayerList(msg.players)) this.onPlayersChange?.(msg.players);
        break;
      case 'EPHEMERAL':
        this.applyEphemeral(msg.senderId, validateEphemeral(msg.event));
        break;
    }
  }

  private scheduleFlush() {
    if (!this.clientReady || this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flushNow(), FLUSH_MS);
  }

  private flushNow() {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (!this.clientReady || !this.lastSynced || !this.hostConn?.open) return;
    const current = this.store.snapshot();
    const delta = diffScenes(this.lastSynced, current);
    this.lastSynced = current;
    if (!isEmptyDelta(delta)) this.hostConn.send({ type: 'DELTA', delta });
  }

  // ── Host side ──────────────────────────────────────────────────────────

  private acceptClient(conn: DataConnection) {
    this.buckets.set(conn, { tokens: RATE_BURST, last: Date.now(), dropped: 0 });
    // A connection that never introduces itself is just holding a slot.
    const helloTimer = setTimeout(() => { if (!this.viewers.has(conn)) conn.close(); }, HELLO_TIMEOUT_MS);
    conn.on('data', (raw) => this.onClientMessage(conn, raw));
    const gone = () => { clearTimeout(helloTimer); this.dropClient(conn); };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  private dropClient(conn: DataConnection) {
    if (!this.viewers.delete(conn)) return;
    this.status(`Host (${this.viewers.size} players connected)`);
    this.broadcastPlayers();
  }

  /** Token bucket. Returns false when this connection is sending faster than any real client would. */
  private allow(conn: DataConnection): boolean {
    const b = this.buckets.get(conn);
    if (!b) return false;
    const now = Date.now();
    b.tokens = Math.min(RATE_BURST, b.tokens + ((now - b.last) / 1000) * RATE_PER_SEC);
    b.last = now;
    if (b.tokens >= 1) { b.tokens -= 1; return true; }
    b.dropped += 1;
    if (b.dropped > RATE_KICK_AFTER_DROPS) conn.close();
    return false;
  }

  private onClientMessage(conn: DataConnection, raw: unknown) {
    if (!this.allow(conn)) return;
    if (typeof raw !== 'object' || raw === null) return;
    const msg = raw as Record<string, unknown>;
    const viewing = this.viewers.get(conn);

    if (msg.type === 'HELLO') {
      if (!viewing) this.admit(conn, msg);
      return;
    }
    // Nothing but HELLO is accepted from a connection that hasn't introduced itself.
    if (!viewing?.ready) return;

    if (msg.type === 'DELTA') {
      const delta = validateDelta(msg.delta);
      if (!delta) return;
      const { delta: allowed, trimmed } = authorizeDelta(delta, this.store.peek(), viewing);
      if (!isEmptyDelta(allowed)) {
        // Don't echo the sender's own change back to them (would fight their in-progress drag).
        if (viewing.lastSent) viewing.lastSent = applyDelta(viewing.lastSent, allowed);
        this.store.replace(applyDelta(this.store.snapshot(), allowed), 'network');
      }
      if (trimmed) this.resync(conn, viewing); // sender's local copy diverged from what we accepted
    } else if (msg.type === 'EPHEMERAL') {
      const event = validateEphemeral(msg.event);
      if (!event) return;
      const senderId = conn.peer; // from the transport, not from the message
      this.applyEphemeral(senderId, event);
      for (const [other, v] of this.viewers) {
        if (other !== conn && v.ready) other.send({ type: 'EPHEMERAL', senderId, event });
      }
    }
  }

  private admit(conn: DataConnection, msg: Record<string, unknown>) {
    let playerId: string | null = null;
    if (isPlayerId(msg.playerId) && isSecret(msg.secret)) {
      const bound = this.bindings[msg.playerId];
      if (bound === undefined) {
        this.bindings[msg.playerId] = msg.secret; // first sight of this id: bind it to this secret
        saveBindings(this.roomId, this.bindings);
        playerId = msg.playerId;
      } else if (safeEqual(bound, msg.secret)) {
        playerId = msg.playerId;
      }
      // else: someone claiming another player's id. They join as an unidentified spectator.
    }

    const isGM = !!this.gmKey && isGmKey(msg.gmKey) && safeEqual(this.gmKey, msg.gmKey);

    // Exploration memory follows the player id, so it survives a refresh (and a host restart).
    let revealed = new Set<string>();
    if (playerId) {
      revealed = this.fogByPlayer.get(playerId) ?? revealed;
      this.fogByPlayer.set(playerId, revealed);
    }
    const viewing: Viewing = { isGM, playerId, lastSent: null, ready: true, memory: createMemory(revealed) };
    this.viewers.set(conn, viewing);

    conn.send({ type: 'WELCOME', isGM, playerId });
    this.resync(conn, viewing);
    this.status(`Host (${this.viewers.size} players connected)`);
    this.broadcastPlayers();
  }

  private resync(conn: DataConnection, viewing: Viewing) {
    const scene = filterSceneForViewer(this.store.snapshot(), viewing, viewing.memory);
    viewing.lastSent = scene;
    const fog = viewing.isGM ? [] : Array.from(viewing.memory.revealed);
    viewing.memory.added = []; // the full list above already covers them
    conn.send({ type: 'SYNC', scene, fog });
    this.scheduleFogSave();
  }

  private schedulePush() {
    if (this.pushTimer) return;
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.pushAll();
    }, FLUSH_MS);
  }

  private pushAll() {
    if (this.viewers.size === 0) return;
    const full = this.store.snapshot();
    for (const [conn, viewing] of this.viewers) {
      if (!viewing.ready || !conn.open) continue;
      if (!viewing.lastSent) { this.resync(conn, viewing); continue; }
      const view = filterSceneForViewer(full, viewing, viewing.memory);
      const delta: Delta = diffScenes(viewing.lastSent, view);
      viewing.lastSent = view;
      if (!isEmptyDelta(delta)) conn.send({ type: 'DELTA', delta });
      if (viewing.memory.added.length > 0) {
        conn.send({ type: 'FOG', add: viewing.memory.added });
        viewing.memory.added = [];
        this.scheduleFogSave();
      }
    }
  }

  private scheduleFogSave() {
    if (this.fogSaveTimer || this.fogByPlayer.size === 0) return;
    this.fogSaveTimer = setTimeout(() => {
      this.fogSaveTimer = null;
      saveFog(this.roomId, this.fogByPlayer);
    }, FOG_SAVE_MS);
  }

  private broadcastPlayers() {
    const players: PlayerInfo[] = [];
    for (const v of this.viewers.values()) if (v.playerId) players.push({ id: v.playerId, isGM: v.isGM });
    this.onPlayersChange?.(players);
    for (const [conn, v] of this.viewers) if (v.isGM && v.ready) conn.send({ type: 'PLAYERS', players });
  }

  // ── Ephemeral ──────────────────────────────────────────────────────────

  private applyEphemeral(senderId: unknown, e: EphemeralEvent | null) {
    if (!e || typeof senderId !== 'string' || senderId.length > 64) return;
    if (e.type === 'CURSOR') this.ephemeralStore.updateCursor(senderId, e.x, e.y, e.color, e.name);
    else if (e.type === 'PING') this.ephemeralStore.addPing(senderId, e.x, e.y, e.color);
    else if (e.type === 'RULER_UPDATE') this.ephemeralStore.updateRuler(senderId, e.startX, e.startY, e.endX, e.endY, e.color);
    else if (e.type === 'RULER_REMOVE') this.ephemeralStore.removeRuler(senderId);
  }

  /** Send a local cursor/ping/ruler event. Invalid events are dropped rather than sent. */
  broadcastEphemeral(payload: unknown) {
    if (!this.connected || !this.peer) return;
    const event = validateEphemeral(payload);
    if (!event) return;
    const msg = { type: 'EPHEMERAL', senderId: this.peer.id, event };
    if (this.isHost) {
      for (const [conn, v] of this.viewers) if (v.ready) conn.send(msg);
    } else if (this.hostConn?.open) {
      this.hostConn.send({ type: 'EPHEMERAL', event });
    }
  }

  destroy() {
    this.destroyed = true;
    for (const t of [this.pushTimer, this.flushTimer, this.retryTimer, this.connectTimer]) if (t) clearTimeout(t);
    if (this.fogSaveTimer) { clearTimeout(this.fogSaveTimer); saveFog(this.roomId, this.fogByPlayer); }
    this.unsubscribe?.();
    this.teardownPeer();
  }
}
