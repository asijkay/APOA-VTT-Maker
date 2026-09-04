export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.1;

export type Point2 = { x: number; y: number };

export function worldToGrid(world: Point2, gridSize: number): { gx: number; gy: number } {
  return {
    gx: Math.floor(world.x / gridSize),
    gy: Math.floor(world.y / gridSize),
  };
}

export function gridToWorld(gx: number, gy: number, gridSize: number): Point2 {
  return { x: gx * gridSize, y: gy * gridSize };
}

export function snapWorldToGrid(world: Point2, gridSize: number): Point2 {
  return {
    x: Math.round(world.x / gridSize) * gridSize,
    y: Math.round(world.y / gridSize) * gridSize,
  };
}

export function cellCenter(gx: number, gy: number, gridSize: number): Point2 {
  return { x: gx * gridSize + gridSize / 2, y: gy * gridSize + gridSize / 2 };
}
