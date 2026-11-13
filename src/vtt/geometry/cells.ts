import type { Point2 } from './segments';

export function cellKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(x: number, y: number, polygon: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Grid cells ("gx,gy") whose centre lies inside the polygon, found by a
 * bounding-box scan. Shared by the client's fog memory and the host's
 * per-player exploration tracking so both agree on what "seen" means.
 */
export function cellsInPolygon(polygon: Point2[], gridSize: number): string[] {
  if (polygon.length < 3) return [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const startGx = Math.floor(minX / gridSize) - 1;
  const startGy = Math.floor(minY / gridSize) - 1;
  const endGx = Math.ceil(maxX / gridSize) + 1;
  const endGy = Math.ceil(maxY / gridSize) + 1;

  const cells: string[] = [];
  for (let gx = startGx; gx <= endGx; gx++) {
    for (let gy = startGy; gy <= endGy; gy++) {
      if (pointInPolygon((gx + 0.5) * gridSize, (gy + 0.5) * gridSize, polygon)) cells.push(cellKey(gx, gy));
    }
  }
  return cells;
}
