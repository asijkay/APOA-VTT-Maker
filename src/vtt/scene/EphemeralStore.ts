export type CursorState = {
  id: string; // peer id
  x: number;
  y: number;
  color: string;
  name: string;
  lastUpdate: number;
};

export type PingState = {
  id: string;
  x: number;
  y: number;
  color: string;
  timestamp: number; // to fade it out
};

export type RulerState = {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  lastUpdate: number;
};

export class EphemeralStore {
  cursors = new Map<string, CursorState>();
  pings: PingState[] = [];
  rulers = new Map<string, RulerState>();
  
  private listeners = new Set<() => void>();
  
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  notify() {
    for (const l of this.listeners) l();
  }
  
  updateCursor(id: string, x: number, y: number, color: string, name: string) {
    this.cursors.set(id, { id, x, y, color, name, lastUpdate: Date.now() });
    this.notify();
  }
  
  addPing(id: string, x: number, y: number, color: string) {
    this.pings.push({ id, x, y, color, timestamp: Date.now() });
    this.notify();
  }
  
  updateRuler(id: string, startX: number, startY: number, endX: number, endY: number, color: string) {
    this.rulers.set(id, { id, startX, startY, endX, endY, color, lastUpdate: Date.now() });
    this.notify();
  }
  
  removeRuler(id: string) {
    if (this.rulers.delete(id)) {
      this.notify();
    }
  }
  
  cleanup() {
    const now = Date.now();
    let changed = false;
    
    // Remove stale cursors (no update in 5s)
    for (const [id, cursor] of this.cursors.entries()) {
      if (now - cursor.lastUpdate > 5000) {
        this.cursors.delete(id);
        changed = true;
      }
    }
    
    // Remove stale rulers (no update in 5s)
    for (const [id, ruler] of this.rulers.entries()) {
      if (now - ruler.lastUpdate > 5000) {
        this.rulers.delete(id);
        changed = true;
      }
    }
    
    // Remove old pings (older than 2s)
    const originalPingCount = this.pings.length;
    this.pings = this.pings.filter(p => now - p.timestamp < 2000);
    if (this.pings.length !== originalPingCount) {
      changed = true;
    }
    
    if (changed) this.notify();
  }
}
