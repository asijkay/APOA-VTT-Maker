import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../engine/Camera';

/**
 * FogRenderer draws the fog-of-war overlay.
 *
 * In GM mode: hidden entirely (GM sees all).
 * In Player mode:
 *   - Black fill over never-seen cells (full fog)
 *   - Dark semi-transparent fill over revealed-but-not-currently-visible cells (memory fog)
 *   - No fill over currently-visible cells (clear)
 */
export class FogRenderer {
  private container: Container;
  private graphics: Graphics;
  private dirty = true;
  private visible = false; // fog off by default (GM mode)

  private revealedCells: Set<string> = new Set();
  private visibleCells: Set<string> = new Set();

  private lastZoom = -1;
  private lastCamX = -Infinity;
  private lastCamY = -Infinity;
  private lastRevealedSize = -1;
  private lastVisibleSize = -1;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.name = 'fogLayer';
    parent.addChild(this.container);
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  getContainer(): Container { return this.container; }

  setVisible(v: boolean): void {
    if (this.visible === v) return;
    this.visible = v;
    this.dirty = true;
  }

  isVisible(): boolean { return this.visible; }

  updateCells(revealedCells: Set<string>, visibleCells: Set<string>): void {
    this.revealedCells = revealedCells;
    this.visibleCells = visibleCells;
    this.dirty = true;
  }

  markDirty(): void { this.dirty = true; }

  update(camera: Camera, gridSize: number): void {
    if (!this.visible) {
      if (this.dirty) {
        this.graphics.clear();
        this.dirty = false;
      }
      return;
    }

    const cs = camera.getState();
    const bounds = camera.getBounds();
    const camChanged =
      cs.zoom !== this.lastZoom ||
      Math.abs(cs.x - this.lastCamX) > 0.5 ||
      Math.abs(cs.y - this.lastCamY) > 0.5;

    const cellsChanged =
      this.revealedCells.size !== this.lastRevealedSize ||
      this.visibleCells.size !== this.lastVisibleSize;

    if (!this.dirty && !camChanged && !cellsChanged) return;

    if (camChanged) {
      this.lastZoom = cs.zoom;
      this.lastCamX = cs.x;
      this.lastCamY = cs.y;
    }
    if (cellsChanged) {
      this.lastRevealedSize = this.revealedCells.size;
      this.lastVisibleSize = this.visibleCells.size;
    }

    this.graphics.clear();

    const vpW = bounds.viewportWidth;
    const vpH = bounds.viewportHeight;

    // Determine visible world bounds
    const topLeft = camera.screenToWorld(0, 0);
    const btmRight = camera.screenToWorld(vpW, vpH);

    const startGx = Math.floor(topLeft.x / gridSize) - 1;
    const startGy = Math.floor(topLeft.y / gridSize) - 1;
    const endGx = Math.ceil(btmRight.x / gridSize) + 1;
    const endGy = Math.ceil(btmRight.y / gridSize) + 1;

    const cellSizePx = gridSize * cs.zoom;

    for (let gx = startGx; gx <= endGx; gx++) {
      for (let gy = startGy; gy <= endGy; gy++) {
        const key = `${gx},${gy}`;
        if (this.visibleCells.has(key)) continue; // fully visible: no fog

        const sp = camera.worldToScreen(gx * gridSize, gy * gridSize);

        if (this.revealedCells.has(key)) {
          // Memory fog: dark semi-transparent
          this.graphics.rect(sp.x, sp.y, cellSizePx, cellSizePx);
          this.graphics.fill({ color: 0x000000, alpha: 0.55 });
        } else {
          // Full fog: solid black
          this.graphics.rect(sp.x, sp.y, cellSizePx, cellSizePx);
          this.graphics.fill({ color: 0x000000, alpha: 0.92 });
        }
      }
    }

    this.dirty = false;
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}
