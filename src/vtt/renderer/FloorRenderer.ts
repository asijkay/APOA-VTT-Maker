import { Container, Graphics } from 'pixi.js';
import type { Scene } from '../scene/SceneTypes';
import type { Camera } from '../engine/Camera';
import { GRID_SIZE } from '../engine/CoordinateSystem';

type DirtyFlags = {
  full: boolean;
};

export class FloorRenderer {
  private container: Container;
  private floorsContainer: Container;
  private graphics: Graphics;
  private lastFloorCount = -1;
  private lastZoom: number = -1;
  private lastCamX: number = -Infinity;
  private lastCamY: number = -Infinity;
  private dirty: DirtyFlags = { full: true };

  private readonly fillColor = 0x1e6eff;
  private readonly fillAlpha = 0.62;

  constructor(stage: Container) {
    this.container = new Container();
    this.container.name = 'floors';
    this.floorsContainer = new Container();
    this.floorsContainer.name = 'floors.tiles';
    this.graphics = new Graphics();
    this.floorsContainer.addChild(this.graphics);
    this.container.addChild(this.floorsContainer);
    stage.addChild(this.container);
  }

  markDirty(): void {
    this.dirty.full = true;
  }

  update(scene: Scene, camera: Camera): void {
    const cs = camera.getState();
    const camChanged =
      cs.zoom !== this.lastZoom ||
      Math.abs(cs.x - this.lastCamX) > 0.05 ||
      Math.abs(cs.y - this.lastCamY) > 0.05;
    if (camChanged) {
      this.lastZoom = cs.zoom;
      this.lastCamX = cs.x;
      this.lastCamY = cs.y;
      this.dirty.full = true;
    }
    if (this.dirty.full || scene.floors.length !== this.lastFloorCount) {
      this.redrawAll(scene, camera);
      this.lastFloorCount = scene.floors.length;
      this.dirty.full = false;
    }
  }

  private redrawAll(scene: Scene, camera: Camera): void {
    this.graphics.clear();
    const size = GRID_SIZE;
    const bounds = camera.getBounds();
    const pad = 1;
    const minGX = Math.floor(bounds.worldLeft / size) - pad;
    const maxGX = Math.ceil(bounds.worldRight / size) + pad;
    const minGY = Math.floor(bounds.worldTop / size) - pad;
    const maxGY = Math.ceil(bounds.worldBottom / size) + pad;

    for (const f of scene.floors) {
      if (f.gridX < minGX || f.gridX > maxGX) continue;
      if (f.gridY < minGY || f.gridY > maxGY) continue;
      const wx1 = f.gridX * size;
      const wy1 = f.gridY * size;
      const wx2 = wx1 + size;
      const wy2 = wy1 + size;
      const r = screenRect(camera, wx1, wy1, wx2, wy2);
      this.graphics.rect(r.sx, r.sy, r.sw, r.sh).fill({ color: this.fillColor, alpha: this.fillAlpha });
    }
  }

  getContainer(): Container {
    return this.container;
  }

  destroy(): void {
    this.graphics.destroy();
    this.floorsContainer.destroy();
    this.container.destroy();
  }
}

/**
 * Projects 4 corners of a world axis-aligned rectangle to screen coordinates,
 * floors min, ceils max, subtracts 1 from min / adds 1 to max to guarantee full
 * CSS-pixel coverage at any zoom or pan fraction — eliminating the "1px cut"
 * artifact when world edges would otherwise land on fractional CSS pixels.
 */
export function screenRect(
  camera: Camera,
  wx1: number,
  wy1: number,
  wx2: number,
  wy2: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const tl = camera.worldToScreen(wx1, wy1);
  const tr = camera.worldToScreen(wx2, wy1);
  const bl = camera.worldToScreen(wx1, wy2);
  const br = camera.worldToScreen(wx2, wy2);
  const minX = Math.min(tl.x, tr.x, bl.x, br.x);
  const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
  const minY = Math.min(tl.y, tr.y, bl.y, br.y);
  const maxY = Math.max(tl.y, tr.y, bl.y, br.y);
  const sx = Math.floor(minX) - 1;
  const sy = Math.floor(minY) - 1;
  const ex = Math.ceil(maxX) + 1;
  const ey = Math.ceil(maxY) + 1;
  return { sx, sy, sw: ex - sx, sh: ey - sy };
}
