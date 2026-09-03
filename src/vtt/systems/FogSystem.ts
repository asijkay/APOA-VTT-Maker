import type { VisionResult } from './VisionSystem';
import { GRID_SIZE } from '../engine/CoordinateSystem';
import type { Point2 } from '../geometry/segments';

/**
 * FogSystem tracks which grid cells have ever been seen by any token.
 * This creates the "memory fog" effect: areas visited are remembered in a
 * desaturated state, while never-visited areas remain fully black.
 */
export class FogSystem {
  /** Set of "gx,gy" keys for cells that have been seen at least once */
  private revealedCells = new Set<string>();
  /** Set of "gx,gy" keys for cells currently visible this frame */
  private currentlyVisibleCells = new Set<string>();

  /**
   * Update the fog state from the current frame's vision results.
   * Newly visible cells are added to revealedCells.
   */
  update(visionResults: VisionResult[]): void {
    this.currentlyVisibleCells = new Set<string>();

    for (const result of visionResults) {
      const cells = this.polygonToGridCells(result.polygon);
      for (const key of cells) {
        this.currentlyVisibleCells.add(key);
        this.revealedCells.add(key);
      }
    }
  }

  getRevealedCells(): Set<string> {
    return this.revealedCells;
  }

  getCurrentlyVisibleCells(): Set<string> {
    return this.currentlyVisibleCells;
  }

  reset(): void {
    this.revealedCells = new Set();
    this.currentlyVisibleCells = new Set();
  }

  /**
   * Converts a visibility polygon to a set of grid cell keys using a simple
   * bounding-box scan + point-in-polygon test.
   */
  private polygonToGridCells(polygon: Point2[]): string[] {
    if (polygon.length < 3) return [];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of polygon) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const startGx = Math.floor(minX / GRID_SIZE) - 1;
    const startGy = Math.floor(minY / GRID_SIZE) - 1;
    const endGx = Math.ceil(maxX / GRID_SIZE) + 1;
    const endGy = Math.ceil(maxY / GRID_SIZE) + 1;

    const cells: string[] = [];
    for (let gx = startGx; gx <= endGx; gx++) {
      for (let gy = startGy; gy <= endGy; gy++) {
        // Test cell center
        const cx = (gx + 0.5) * GRID_SIZE;
        const cy = (gy + 0.5) * GRID_SIZE;
        if (this.pointInPolygon(cx, cy, polygon)) {
          cells.push(`${gx},${gy}`);
        }
      }
    }
    return cells;
  }

  /** Ray-casting point-in-polygon test */
  private pointInPolygon(x: number, y: number, polygon: Point2[]): boolean {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
