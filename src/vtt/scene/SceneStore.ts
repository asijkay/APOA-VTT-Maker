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
}
