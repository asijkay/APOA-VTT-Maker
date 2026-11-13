import type { VisionResult } from './VisionSystem';
import { cellsInPolygon } from '../geometry/cells';

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
  update(visionResults: VisionResult[], gridSize: number): void {
    this.currentlyVisibleCells = new Set<string>();

    for (const result of visionResults) {
      const cells = cellsInPolygon(result.polygon, gridSize);
      for (const key of cells) {
        this.currentlyVisibleCells.add(key);
        this.revealedCells.add(key);
      }
    }
  }

  /** Merge cells remembered elsewhere (the host's per-player exploration record). */
  mergeRevealed(cells: Iterable<string>): void {
    for (const c of cells) this.revealedCells.add(c);
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
}
