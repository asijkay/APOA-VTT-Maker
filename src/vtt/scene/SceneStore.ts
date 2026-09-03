import { type ID, createEmptyScene, type Scene } from './SceneTypes';

let nextN = 0;
export function genId(prefix = 'id'): ID {
  nextN += 1;
  return `${prefix}_${Date.now().toString(36)}_${nextN.toString(36)}`;
}

export type SceneChange = {
  scene: Scene;
  kind:
    | 'add-floor'
    | 'remove-floor'
    | 'add-wall'
    | 'update-wall'
    | 'remove-wall'
    | 'add-door'
    | 'update-door'
    | 'remove-door'
    | 'add-window'
    | 'update-window'
    | 'remove-window'
    | 'add-light'
    | 'update-light'
    | 'remove-light'
    | 'add-token'
    | 'update-token'
    | 'remove-token'
    | 'replace';
  affectedIds: ID[];
};

export type SceneListener = (change: SceneChange) => void;

export type FloorTileInput = {
  gridX: number;
  gridY: number;
  elevation?: number;
  materialId?: ID;
};

export type WallInput = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  elevation?: number;
  blocksVision?: boolean;
  blocksMovement?: boolean;
};

export type TokenInput = {
  x: number;
  y: number;
  elevation?: number;
  radius?: number;
  visionRadius?: number;
};

export type DoorInput = {
  wallId: ID;
  position: number;
  width?: number;
  state?: 'open' | 'closed';
  locked?: boolean;
  hidden?: boolean;
};

export type WindowInput = {
  wallId: ID;
  position: number;
  width?: number;
};

export type LightInput = {
  x: number;
  y: number;
  elevation?: number;
  radius?: number;
  color?: string;
  enabled?: boolean;
};

export class SceneStore {
  private scene: Scene;
  private listeners = new Set<SceneListener>();

  constructor(initial: Scene = createEmptyScene()) {
    this.scene = structuredClone(initial);
  }

  snapshot(): Scene {
    return structuredClone(this.scene);
  }

  subscribe(listener: SceneListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(kind: SceneChange['kind'], affectedIds: ID[]): void {
    const change: SceneChange = { scene: this.snapshot(), kind, affectedIds };
    for (const l of this.listeners) l(change);
  }

  findFloorByCell(
    gridX: number,
    gridY: number,
    elevation = 0,
  ): { id: ID } | undefined {
    return this.scene.floors.find(
      (f) => f.gridX === gridX && f.gridY === gridY && f.elevation === elevation,
    );
  }

  addFloorTile(input: FloorTileInput): { id: ID } | undefined {
    const elevation = input.elevation ?? 0;
    if (this.findFloorByCell(input.gridX, input.gridY, elevation)) return undefined;
    const id = genId('floor');
    this.scene.floors.push({
      id,
      gridX: input.gridX,
      gridY: input.gridY,
      elevation,
      materialId: input.materialId,
    });
    this.emit('add-floor', [id]);
    return { id };
  }

  addFloorTilesBulk(inputs: FloorTileInput[]): ID[] {
    const added: ID[] = [];
    const seen = new Set<string>();
    for (const f of this.scene.floors) {
      seen.add(`${f.elevation},${f.gridX},${f.gridY}`);
    }
    for (const input of inputs) {
      const elevation = input.elevation ?? 0;
      const key = `${elevation},${input.gridX},${input.gridY}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const id = genId('floor');
      this.scene.floors.push({
        id,
        gridX: input.gridX,
        gridY: input.gridY,
        elevation,
        materialId: input.materialId,
      });
      added.push(id);
    }
    if (added.length > 0) this.emit('add-floor', added);
    return added;
  }

  removeFloorTile(id: ID): boolean {
    const i = this.scene.floors.findIndex((f) => f.id === id);
    if (i < 0) return false;
    this.scene.floors.splice(i, 1);
    this.emit('remove-floor', [id]);
    return true;
  }

  removeFloorTileAt(
    gridX: number,
    gridY: number,
    elevation = 0,
  ): { id: ID } | undefined {
    const i = this.scene.floors.findIndex(
      (f) => f.gridX === gridX && f.gridY === gridY && f.elevation === elevation,
    );
    if (i < 0) return undefined;
    const id = this.scene.floors[i].id;
    this.scene.floors.splice(i, 1);
    this.emit('remove-floor', [id]);
    return { id };
  }

  removeFloorTilesBulkAt(
    cells: { gridX: number; gridY: number; elevation?: number }[],
  ): ID[] {
    const removed: ID[] = [];
    const target = new Set(
      cells.map((c) => `${c.elevation ?? 0},${c.gridX},${c.gridY}`),
    );
    const kept = [];
    for (const f of this.scene.floors) {
      if (target.has(`${f.elevation},${f.gridX},${f.gridY}`)) removed.push(f.id);
      else kept.push(f);
    }
    if (removed.length === 0) return [];
    this.scene.floors = kept;
    this.emit('remove-floor', removed);
    return removed;
  }

  addWall(input: WallInput): { id: ID } | undefined {
    const x1 = Math.min(input.x1, input.x2);
    const y1 = Math.min(input.y1, input.y2);
    const x2 = Math.max(input.x1, input.x2);
    const y2 = Math.max(input.y1, input.y2);
    const isHorizontal = y1 === y2;
    const isVertical = x1 === x2;
    if (!isHorizontal && !isVertical) return undefined;
    if (x1 === x2 && y1 === y2) return undefined;
    const elevation = input.elevation ?? 0;
    const id = genId('wall');
    this.scene.walls.push({
      id,
      x1,
      y1,
      x2,
      y2,
      elevation,
      blocksVision: input.blocksVision ?? true,
      blocksMovement: input.blocksMovement ?? true,
    });
    this.emit('add-wall', [id]);
    return { id };
  }

  updateWall(id: ID, patch: Partial<Omit<import('./SceneTypes').Wall, 'id'>>): boolean {
    const w = this.scene.walls.find((x) => x.id === id);
    if (!w) return false;
    Object.assign(w, patch);
    this.emit('update-wall', [id]);
    return true;
  }

  removeWall(id: ID): boolean {
    const i = this.scene.walls.findIndex((w) => w.id === id);
    if (i < 0) return false;
    this.scene.walls.splice(i, 1);
    this.emit('remove-wall', [id]);
    return true;
  }

  findWallById(id: ID): import('./SceneTypes').Wall | undefined {
    return this.scene.walls.find((w) => w.id === id);
  }

  /**
   * Find nearest wall to a world point within maxDistance (world units).
   * Only considers axis-aligned walls. Returns the wall id and distance (squared) on hit.
   */
  findNearestWall(
    worldX: number,
    worldY: number,
    maxDistance = 25,
    elevation = 0,
  ): { id: ID; distanceSq: number } | undefined {
    const maxSq = maxDistance * maxDistance;
    let best: { id: ID; distanceSq: number } | undefined;
    for (const w of this.scene.walls) {
      if (w.elevation !== elevation) continue;
      let dx: number;
      let dy: number;
      if (w.y1 === w.y2) {
        dx = worldX < w.x1 ? w.x1 - worldX : worldX > w.x2 ? worldX - w.x2 : 0;
        dy = worldY - w.y1;
      } else if (w.x1 === w.x2) {
        dy = worldY < w.y1 ? w.y1 - worldY : worldY > w.y2 ? worldY - w.y2 : 0;
        dx = worldX - w.x1;
      } else {
        continue;
      }
      const dsq = dx * dx + dy * dy;
      if (dsq <= maxSq && (!best || dsq < best.distanceSq)) {
        best = { id: w.id, distanceSq: dsq };
      }
    }
    return best;
  }

  addToken(input: TokenInput): { id: ID } {
    const id = genId('token');
    this.scene.tokens.push({
      id,
      x: input.x,
      y: input.y,
      elevation: input.elevation ?? 0,
      radius: input.radius ?? 15,
      visionRadius: input.visionRadius ?? 300,
    });
    this.emit('add-token', [id]);
    return { id };
  }

  updateToken(
    id: ID,
    patch: Partial<Omit<import('./SceneTypes').Token, 'id'>>,
  ): boolean {
    const t = this.scene.tokens.find((x) => x.id === id);
    if (!t) return false;
    Object.assign(t, patch);
    this.emit('update-token', [id]);
    return true;
  }

  removeToken(id: ID): boolean {
    const i = this.scene.tokens.findIndex((t) => t.id === id);
    if (i < 0) return false;
    this.scene.tokens.splice(i, 1);
    this.emit('remove-token', [id]);
    return true;
  }

  findTokenById(id: ID): import('./SceneTypes').Token | undefined {
    return this.scene.tokens.find((t) => t.id === id);
  }

  findTokenNear(
    worldX: number,
    worldY: number,
    maxDistance = 20,
    elevation = 0,
  ): { id: ID; distanceSq: number } | undefined {
    let best: { id: ID; distanceSq: number } | undefined;
    for (const t of this.scene.tokens) {
      if (t.elevation !== elevation) continue;
      const dx = worldX - t.x;
      const dy = worldY - t.y;
      const dsq = dx * dx + dy * dy;
      const hitR = Math.max(t.radius, maxDistance);
      if (dsq <= hitR * hitR && (!best || dsq < best.distanceSq)) {
        best = { id: t.id, distanceSq: dsq };
      }
    }
    return best;
  }

  addDoor(input: DoorInput): { id: ID } | undefined {
    // Verify wall exists
    const wall = this.scene.walls.find(w => w.id === input.wallId);
    if (!wall) return undefined;
    
    // Validate position is within [0, 1]
    if (input.position < 0 || input.position > 1) return undefined;
    
    const id = genId('door');
    this.scene.doors.push({
      id,
      wallId: input.wallId,
      position: input.position,
      width: input.width ?? 20,
      state: input.state ?? 'closed',
      locked: input.locked ?? false,
      hidden: input.hidden ?? false,
    });
    this.emit('add-door', [id]);
    return { id };
  }

  updateDoor(id: ID, patch: Partial<Omit<import('./SceneTypes').Door, 'id'>>): boolean {
    const d = this.scene.doors.find((x) => x.id === id);
    if (!d) return false;
    Object.assign(d, patch);
    this.emit('update-door', [id]);
    return true;
  }

  removeDoor(id: ID): boolean {
    const i = this.scene.doors.findIndex((d) => d.id === id);
    if (i < 0) return false;
    this.scene.doors.splice(i, 1);
    this.emit('remove-door', [id]);
    return true;
  }

  findDoorById(id: ID): import('./SceneTypes').Door | undefined {
    return this.scene.doors.find((d) => d.id === id);
  }

  addLight(input: LightInput): { id: ID } {
    const id = genId('light');
    this.scene.lights.push({
      id,
      x: input.x,
      y: input.y,
      elevation: input.elevation ?? 0,
      radius: input.radius ?? 150,
      color: input.color ?? '#FFFFFF',
      enabled: input.enabled ?? true,
    });
    this.emit('add-light', [id]);
    return { id };
  }

  updateLight(id: ID, patch: Partial<Omit<import('./SceneTypes').Light, 'id'>>): boolean {
    const l = this.scene.lights.find((x) => x.id === id);
    if (!l) return false;
    Object.assign(l, patch);
    this.emit('update-light', [id]);
    return true;
  }

  removeLight(id: ID): boolean {
    const i = this.scene.lights.findIndex((l) => l.id === id);
    if (i < 0) return false;
    this.scene.lights.splice(i, 1);
    this.emit('remove-light', [id]);
    return true;
  }

  findLightById(id: ID): import('./SceneTypes').Light | undefined {
    return this.scene.lights.find((l) => l.id === id);
  }

  // ── Windows ──────────────────────────────────────────────────────────────

  addWindow(input: WindowInput): { id: ID } | undefined {
    const wall = this.scene.walls.find(w => w.id === input.wallId);
    if (!wall) return undefined;
    if (input.position < 0 || input.position > 1) return undefined;
    const id = genId('win');
    this.scene.windows.push({
      id,
      wallId: input.wallId,
      position: input.position,
      width: input.width ?? 30,
    });
    this.emit('add-window', [id]);
    return { id };
  }

  updateWindow(id: ID, patch: Partial<Omit<import('./SceneTypes').Window, 'id'>>): boolean {
    const w = this.scene.windows.find(x => x.id === id);
    if (!w) return false;
    Object.assign(w, patch);
    this.emit('update-window', [id]);
    return true;
  }

  removeWindow(id: ID): boolean {
    const i = this.scene.windows.findIndex(w => w.id === id);
    if (i < 0) return false;
    this.scene.windows.splice(i, 1);
    this.emit('remove-window', [id]);
    return true;
  }

  findWindowById(id: ID): import('./SceneTypes').Window | undefined {
    return this.scene.windows.find(w => w.id === id);
  }

  // ── Serialization ────────────────────────────────────────────────────────

  /**
   * Returns the current scene as a serializable plain object.
   */
  serialize(): import('./SceneTypes').Scene {
    return this.snapshot();
  }

  /**
   * Replaces the entire scene with a new one (e.g., loaded from file).
   * Notifies all listeners.
   */
  replace(newScene: import('./SceneTypes').Scene): void {
    this.scene = structuredClone(newScene);
    this.emit('replace', []);
  }
}
