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
    | 'add-image'
    | 'update-image'
    | 'remove-image'
    | 'update-scene-settings'
    | 'replace';
  affectedIds: ID[];
};

export type SceneListener = (change: SceneChange) => void;

export type FloorTileInput = {
  gridX: number;
  gridY: number;
  elevation?: number;
  materialId?: ID;
  id?: ID;
};

export type WallInput = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  elevation?: number;
  blocksVision?: boolean;
  blocksMovement?: boolean;
  id?: ID;
};

export type TokenInput = {
  x: number;
  y: number;
  elevation?: number;
  radius?: number;
  visionRadius?: number;
  name?: string;
  imageUrl?: string;
  id?: ID;
};

export type DoorInput = {
  wallId: ID;
  position: number;
  width?: number;
  state?: 'open' | 'closed';
  locked?: boolean;
  hidden?: boolean;
  id?: ID;
};

export type WindowInput = {
  wallId: ID;
  position: number;
  width?: number;
  id?: ID;
};

export type LightInput = {
  x: number;
  y: number;
  elevation?: number;
  radius?: number;
  color?: string;
  enabled?: boolean;
  id?: ID;
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
    const id = input.id ?? genId('floor');
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
    const x1 = input.x1;
    const y1 = input.y1;
    const x2 = input.x2;
    const y2 = input.y2;
    if (x1 === x2 && y1 === y2) return undefined;
    const elevation = input.elevation ?? 0;
    const id = input.id ?? genId('wall');
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
      
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const lenSq = dx * dx + dy * dy;
      
      let t = 0;
      if (lenSq > 0) {
        t = ((worldX - w.x1) * dx + (worldY - w.y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
      }
      
      const projX = w.x1 + t * dx;
      const projY = w.y1 + t * dy;
      
      const dsq = (worldX - projX) ** 2 + (worldY - projY) ** 2;
      
      if (dsq <= maxSq && (!best || dsq < best.distanceSq)) {
        best = { id: w.id, distanceSq: dsq };
      }
    }
    return best;
  }

  addToken(input: TokenInput): { id: ID } {
    const id = input.id ?? genId('tok');
    const tokenNumber = this.scene.tokens.length + 1;
    this.scene.tokens.push({
      id,
      x: input.x,
      y: input.y,
      elevation: input.elevation ?? 0,
      radius: input.radius ?? 10,
      visionRadius: input.visionRadius ?? 300,
      name: input.name ?? `Token ${tokenNumber}`,
      imageUrl: input.imageUrl,
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

  private getWallPos(wallId: ID, pos: number): { x: number; y: number } | undefined {
    const wall = this.findWallById(wallId);
    if (!wall) return undefined;
    return {
      x: wall.x1 + (wall.x2 - wall.x1) * pos,
      y: wall.y1 + (wall.y2 - wall.y1) * pos,
    };
  }

  addDoor(input: DoorInput): { id: ID } | undefined {
    // Verify wall exists
    const wall = this.scene.walls.find(w => w.id === input.wallId);
    if (!wall) return undefined;
    
    // Validate position is within [0, 1]
    if (input.position < 0 || input.position > 1) return undefined;
    
    const id = input.id ?? genId('door');
    this.scene.doors.push({
      id,
      wallId: input.wallId,
      position: input.position,
      width: input.width ?? 50,
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

  findDoorNear(worldX: number, worldY: number, maxDistance = 20): { id: ID; distanceSq: number } | undefined {
    let best: { id: ID; distanceSq: number } | undefined;
    for (const d of this.scene.doors) {
      const pos = this.getWallPos(d.wallId, d.position);
      if (!pos) continue;
      const dx = worldX - pos.x;
      const dy = worldY - pos.y;
      const dsq = dx * dx + dy * dy;
      if (dsq <= maxDistance * maxDistance && (!best || dsq < best.distanceSq)) {
        best = { id: d.id, distanceSq: dsq };
      }
    }
    return best;
  }

  addLight(input: LightInput): { id: ID } {
    const id = input.id ?? genId('light');
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

  findLightNear(
    worldX: number,
    worldY: number,
    maxDistance = 20,
    elevation = 0,
  ): { id: ID; distanceSq: number } | undefined {
    let best: { id: ID; distanceSq: number } | undefined;
    for (const l of this.scene.lights) {
      if (l.elevation !== elevation) continue;
      const dx = worldX - l.x;
      const dy = worldY - l.y;
      const dsq = dx * dx + dy * dy;
      if (dsq <= maxDistance * maxDistance && (!best || dsq < best.distanceSq)) {
        best = { id: l.id, distanceSq: dsq };
      }
    }
    return best;
  }

  // ── Windows ──────────────────────────────────────────────────────────────

  addWindow(input: WindowInput): { id: ID } | undefined {
    const wall = this.scene.walls.find(w => w.id === input.wallId);
    if (!wall) return undefined;
    if (input.position < 0 || input.position > 1) return undefined;
    const id = input.id ?? genId('win');
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

  findWindowNear(worldX: number, worldY: number, maxDistance = 20): { id: ID; distanceSq: number } | undefined {
    let best: { id: ID; distanceSq: number } | undefined;
    for (const w of this.scene.windows) {
      const pos = this.getWallPos(w.wallId, w.position);
      if (!pos) continue;
      const dx = worldX - pos.x;
      const dy = worldY - pos.y;
      const dsq = dx * dx + dy * dy;
      if (dsq <= maxDistance * maxDistance && (!best || dsq < best.distanceSq)) {
        best = { id: w.id, distanceSq: dsq };
      }
    }
    return best;
  }

  // ── Images ────────────────────────────────────────────────────────

  addImage(input: { url: string; x: number; y: number; width?: number; height?: number; opacity?: number; locked?: boolean; id?: ID }): { id: ID } {
    const id = input.id ?? genId('img');
    this.scene.images.push({
      id,
      url: input.url,
      x: input.x,
      y: input.y,
      width: input.width ?? 500,
      height: input.height ?? 500,
      opacity: input.opacity ?? 1.0,
      locked: input.locked ?? false,
    });
    this.emit('add-image', [id]);
    return { id };
  }

  updateImage(id: ID, patch: Partial<Omit<import('./SceneTypes').MapImage, 'id'>>): boolean {
    const img = this.scene.images.find(x => x.id === id);
    if (!img) return false;
    Object.assign(img, patch);
    this.emit('update-image', [id]);
    return true;
  }

  removeImage(id: ID): boolean {
    const i = this.scene.images.findIndex(img => img.id === id);
    if (i < 0) return false;
    this.scene.images.splice(i, 1);
    this.emit('remove-image', [id]);
    return true;
  }

  findImageById(id: ID): import('./SceneTypes').MapImage | undefined {
    return this.scene.images.find(img => img.id === id);
  }

  findImageNear(worldX: number, worldY: number): { id: ID; distanceSq: number } | undefined {
    // Return the topmost image that contains the point
    for (let i = this.scene.images.length - 1; i >= 0; i--) {
      const img = this.scene.images[i];
      if (img.locked) continue;
      const halfW = img.width / 2;
      const halfH = img.height / 2;
      if (
        worldX >= img.x - halfW && worldX <= img.x + halfW &&
        worldY >= img.y - halfH && worldY <= img.y + halfH
      ) {
        // Compute distance from center just for ranking if needed, though containment is better
        const dx = worldX - img.x;
        const dy = worldY - img.y;
        return { id: img.id, distanceSq: dx * dx + dy * dy };
      }
    }
    return undefined;
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

  // ── Settings ────────────────────────────────────────────────────────

  updateSceneSettings(settings: { gridSize?: number; mapWidth?: number; mapHeight?: number }): void {
    if (settings.gridSize !== undefined) {
      this.scene.gridSize = settings.gridSize;
    }
    if (settings.mapWidth !== undefined) {
      this.scene.mapWidth = settings.mapWidth;
    }
    if (settings.mapHeight !== undefined) {
      this.scene.mapHeight = settings.mapHeight;
    }
    this.emit('update-scene-settings', []);
  }
}
