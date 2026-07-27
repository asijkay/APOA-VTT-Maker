export const GRID_SIZE = 50;

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.1;

export type Point2 = { x: number; y: number };

export function worldToGrid(world: Point2): { gx: number; gy: number } {
  return {
    gx: Math.floor(world.x / GRID_SIZE),
    gy: Math.floor(world.y / GRID_SIZE),
  };
}

export function gridToWorld(gx: number, gy: number): Point2 {
  return { x: gx * GRID_SIZE, y: gy * GRID_SIZE };
}

export function snapWorldToGrid(world: Point2): Point2 {
  return {
    x: Math.round(world.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(world.y / GRID_SIZE) * GRID_SIZE,
  };
}
