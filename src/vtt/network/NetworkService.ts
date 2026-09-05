import Peer, { DataConnection } from 'peerjs';
import type { SceneStore } from '../scene/SceneStore';
import type { EphemeralStore } from '../scene/EphemeralStore';
import type { Scene } from '../scene/SceneTypes';

export class NetworkService {
  peer: Peer | null = null;
  connections: Set<DataConnection> = new Set();
  isHost = false;
  connected = false;
  onStatusChange: ((status: string) => void) | null = null;
  
  constructor(private roomId: string, private store: SceneStore, private ephemeralStore: EphemeralStore) {}
  
  private updateStatus(status: string) {
    if (this.onStatusChange) this.onStatusChange(status);
    console.log(`[NetworkService] ${status}`);
  }

  init() {
    this.updateStatus('Initializing connection...');
    
    // We attempt to claim the specific room ID.
    // If it succeeds, we are the host. If it fails, the host is already there, so we connect as a client.
    this.peer = new Peer(`vtt-maker-room-${this.roomId}`);
    
    this.peer.on('open', () => {
      this.isHost = true;
      this.connected = true;
      this.updateStatus('Host (Waiting for players...)');
      
      this.peer!.on('connection', (conn) => this.handleClientConnection(conn));
    });
    
    this.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        this.updateStatus('Room exists, joining as player...');
        this.isHost = false;
        this.joinRoom();
      } else {
        this.updateStatus(`Error: ${err.message}`);
        console.error('PeerJS error:', err);
      }
    });

    // Listen to local scene changes to broadcast
    this.store.subscribe((change, source) => {
      if (source === 'local') {
        this.broadcastScene(change.scene);
      }
    });

    // We don't subscribe to ephemeralStore here because ephemeralStore is driven by network 
    // AND by local actions which call broadcastEphemeral directly.
  }
  
  private joinRoom() {
    this.peer = new Peer();
    
    this.peer.on('open', () => {
      const conn = this.peer!.connect(`vtt-maker-room-${this.roomId}`);
      
      conn.on('open', () => {
        this.connected = true;
        this.connections.add(conn);
        this.updateStatus('Connected to Host');
        
        // Request the current map state from the host
        conn.send({ type: 'REQUEST_SYNC' });
      });
      
      conn.on('data', (data: any) => this.handleData(data, conn));
      
      conn.on('close', () => {
        this.connections.delete(conn);
        this.updateStatus('Disconnected from Host');
      });
    });
  }
  
  private handleClientConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.add(conn);
      this.updateStatus(`Host (${this.connections.size} players connected)`);
      // Send the current scene immediately upon connection
      conn.send({ type: 'SCENE_SYNC', scene: this.store.serialize() });
    });
    
    conn.on('data', (data: any) => this.handleData(data, conn));
    
    conn.on('close', () => {
      this.connections.delete(conn);
      this.updateStatus(`Host (${this.connections.size} players connected)`);
    });
  }
  
  private handleData(data: any, conn: DataConnection) {
    if (data.type === 'REQUEST_SYNC' && this.isHost) {
      // Client asked for the latest state
      conn.send({ type: 'SCENE_SYNC', scene: this.store.serialize() });
    } else if (data.type === 'SCENE_SYNC') {
      // Received a new map state (from host or client)
      this.store.replace(data.scene as Scene, 'network');
      
      // If we are the host, we should forward this updated scene to all *other* clients
      if (this.isHost) {
        for (const otherConn of this.connections) {
          if (otherConn !== conn) {
            otherConn.send({ type: 'SCENE_SYNC', scene: data.scene });
          }
        }
      }
    } else if (data.type === 'EPHEMERAL_SYNC') {
      const e = data.payload;
      
      if (e.type === 'CURSOR') {
        this.ephemeralStore.updateCursor(e.id, e.x, e.y, e.color, e.name);
      } else if (e.type === 'PING') {
        this.ephemeralStore.addPing(e.id, e.x, e.y, e.color);
      } else if (e.type === 'RULER_UPDATE') {
        this.ephemeralStore.updateRuler(e.id, e.startX, e.startY, e.endX, e.endY, e.color);
      } else if (e.type === 'RULER_REMOVE') {
        this.ephemeralStore.removeRuler(e.id);
      }

      // If we are host, forward ephemeral state to all other clients
      if (this.isHost) {
        for (const otherConn of this.connections) {
          if (otherConn !== conn) {
            otherConn.send(data);
          }
        }
      }
    }
  }
  
  private broadcastScene(scene: Scene) {
    const data = { type: 'SCENE_SYNC', scene };
    for (const conn of this.connections) {
      conn.send(data);
    }
  }

  broadcastEphemeral(payload: any) {
    if (!this.connected || !this.peer) return;
    
    // Inject our peer ID so others know who this is
    payload.id = this.peer.id;
    
    const data = { type: 'EPHEMERAL_SYNC', payload };
    for (const conn of this.connections) {
      conn.send(data);
    }
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections.clear();
  }
}
