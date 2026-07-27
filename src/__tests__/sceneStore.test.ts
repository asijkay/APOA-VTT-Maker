import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SceneStore } from '@/vtt/scene/SceneStore';
import { createEmptyScene } from '@/vtt/scene/SceneTypes';

describe('SceneStore', () => {
  let store: SceneStore;
  beforeEach(() => {
    store = new SceneStore();
  });

  it('starts with an empty scene', () => {
    const s = store.snapshot();
    expect(s.floors).toEqual([]);
    expect(s.walls).toEqual([]);
    expect(s.doors).toEqual([]);
    expect(s.lights).toEqual([]);
    expect(s.tokens).toEqual([]);
    expect(createEmptyScene()).toEqual(s);
  });

  it('addFloorTile stores a tile with the correct grid coords and elevation', () => {
    const result = store.addFloorTile({ gridX: 2, gridY: 3 });
    expect(result).toBeDefined();
    const s = store.snapshot();
    expect(s.floors).toHaveLength(1);
    expect(s.floors[0]).toMatchObject({ gridX: 2, gridY: 3, elevation: 0 });
    expect(s.floors[0].id).toBe(result!.id);
  });

  it('addFloorTile dedupes tiles in the same cell/elevation', () => {
    const r1 = store.addFloorTile({ gridX: 0, gridY: 0, elevation: 0 });
    const r2 = store.addFloorTile({ gridX: 0, gridY: 0, elevation: 0 });
    expect(r1).toBeDefined();
    expect(r2).toBeUndefined();
    expect(store.snapshot().floors).toHaveLength(1);
  });

  it('addFloorTile keeps different elevations separate', () => {
    store.addFloorTile({ gridX: 0, gridY: 0, elevation: 0 });
    store.addFloorTile({ gridX: 0, gridY: 0, elevation: 1 });
    expect(store.snapshot().floors).toHaveLength(2);
  });

  it('addFloorTilesBulk ignores duplicates against existing scene and batch-internal', () => {
    store.addFloorTile({ gridX: 0, gridY: 0 });
    const added = store.addFloorTilesBulk([
      { gridX: 0, gridY: 0 },
      { gridX: 1, gridY: 0 },
      { gridX: 1, gridY: 0 },
      { gridX: 2, gridY: 2 },
    ]);
    expect(added).toHaveLength(2);
    expect(store.snapshot().floors.map((f) => `${f.gridX},${f.gridY}`).sort()).toEqual([
      '0,0',
      '1,0',
      '2,2',
    ]);
  });

  it('removeFloorTileAt removes only the exact cell', () => {
    store.addFloorTile({ gridX: 1, gridY: 2, elevation: 0 });
    store.addFloorTile({ gridX: 1, gridY: 2, elevation: 1 });
    const removed = store.removeFloorTileAt(1, 2, 0);
    expect(removed).toBeDefined();
    const remain = store.snapshot().floors;
    expect(remain).toHaveLength(1);
    expect(remain[0].elevation).toBe(1);
    expect(store.removeFloorTileAt(999, 999)).toBeUndefined();
  });

  it('removeFloorTilesBulkAt removes many cells without touching neighbors', () => {
    store.addFloorTilesBulk([
      { gridX: 0, gridY: 0 },
      { gridX: 1, gridY: 0 },
      { gridX: 2, gridY: 0 },
      { gridX: 0, gridY: 1 },
    ]);
    const removed = store.removeFloorTilesBulkAt([
      { gridX: 0, gridY: 0 },
      { gridX: 1, gridY: 0 },
      { gridX: 9, gridY: 9 },
    ]);
    expect(removed).toHaveLength(2);
    expect(
      store.snapshot().floors.map((f) => `${f.gridX},${f.gridY}`).sort(),
    ).toEqual(['0,1', '2,0']);
  });

  it('findFloorByCell is elevation-aware', () => {
    store.addFloorTile({ gridX: 10, gridY: 20, elevation: 3 });
    expect(store.findFloorByCell(10, 20, 3)).toBeDefined();
    expect(store.findFloorByCell(10, 20, 0)).toBeUndefined();
  });

  it('subscribe fires for add and remove with snapshot-in-time', () => {
    const events: Array<{ kind: string; count: number }> = [];
    const unsub = store.subscribe((c) => {
      events.push({ kind: c.kind, count: c.scene.floors.length });
    });
    store.addFloorTile({ gridX: 0, gridY: 0 });
    store.addFloorTile({ gridX: 1, gridY: 0 });
    store.removeFloorTileAt(0, 0);
    unsub();
    store.addFloorTile({ gridX: 9, gridY: 9 });
    expect(events).toEqual([
      { kind: 'add-floor', count: 1 },
      { kind: 'add-floor', count: 2 },
      { kind: 'remove-floor', count: 1 },
    ]);
  });

  it('snapshot is a deep clone: mutation does not affect store state', () => {
    store.addFloorTile({ gridX: 5, gridY: 5 });
    const snap = store.snapshot();
    snap.floors.pop();
    expect(store.snapshot().floors).toHaveLength(1);
    void vi;
  });
});
