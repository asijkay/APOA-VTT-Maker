import type { SceneStore } from './SceneStore';

export function loadTestRoom(store: SceneStore, roomId: number) {
  // Clear the existing scene first
  const allFloors = store.snapshot().floors.map((f) => ({ gridX: f.gridX, gridY: f.gridY, elevation: f.elevation }));
  store.removeFloorTilesBulkAt(allFloors);
  store.snapshot().walls.forEach((w) => store.removeWall(w.id));
  store.snapshot().doors.forEach((d) => store.removeDoor(d.id));
  store.snapshot().lights.forEach((l) => store.removeLight(l.id));
  store.snapshot().tokens.forEach((t) => store.removeToken(t.id));

  if (roomId === 1) {
    // A simple closed room 400x400
    store.addWall({ x1: 100, y1: 100, x2: 500, y2: 100 });
    store.addWall({ x1: 500, y1: 100, x2: 500, y2: 500 });
    store.addWall({ x1: 500, y1: 500, x2: 100, y2: 500 });
    store.addWall({ x1: 100, y1: 500, x2: 100, y2: 100 });

    const wall = store.snapshot().walls[2];
    store.addDoor({ wallId: wall.id, position: 0.5, state: 'closed' });

    store.addToken({ x: 300, y: 300, radius: 20, visionRadius: 600 });
    store.addLight({ x: 350, y: 150, radius: 400, color: '#ffcc88' });
  } else if (roomId === 2) {
    // Corridors and multiple rooms
    store.addWall({ x1: 100, y1: 100, x2: 600, y2: 100 });
    store.addWall({ x1: 600, y1: 100, x2: 600, y2: 400 });
    store.addWall({ x1: 600, y1: 400, x2: 100, y2: 400 });
    store.addWall({ x1: 100, y1: 400, x2: 100, y2: 100 });
    
    // Inner wall
    store.addWall({ x1: 350, y1: 100, x2: 350, y2: 400 });

    const innerWall = store.snapshot().walls[4];
    store.addDoor({ wallId: innerWall.id, position: 0.5, state: 'closed' });

    store.addToken({ x: 200, y: 250, radius: 20, visionRadius: 800 });
    store.addLight({ x: 200, y: 250, radius: 200, color: '#88ccff' });
    store.addLight({ x: 500, y: 250, radius: 200, color: '#ff8888' });
  }
}
