import { Container, Graphics } from 'pixi.js';
import type { Scene } from '../scene/SceneTypes';
import { GRID_SIZE } from '../engine/CoordinateSystem';
import type { Camera } from '../engine/Camera';

type DirtyFlags = {
  full: boolean;
};

export class FloorRenderer {
  private container: Container;
  private floorsContainer: Container;
  private graphics: Graphics;
  private lastFloorCount = -1;
  private dirty: DirtyFlags = { full: true };

  private readonly fillColor = 0x3a6ea5;
  private readonly fillAlpha = 0.45;
  private readonly strokeColor = 0x5aa3d9;
  private readonly strokeAlpha = 0.9;

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
    if (this.dirty.full || scene.floors.length !== this.lastFloorCount) {
      this.redrawAll(scene);
      this.lastFloorCount = scene.floors.length;
      this.dirty.full = false;
    }
    const bounds = camera.getBounds();
    this.floorsContainer.mask = this.buildCullingMask(bounds);
  }

  private buildCullingMask(bounds: ReturnType<Camera['getBounds']>): Graphics {
    const g = new Graphics();
    const pad = GRID_SIZE * 2;
    g.rect(
      bounds.worldLeft - pad,
      bounds.worldTop - pad,
      bounds.worldRight - bounds.worldLeft + pad * 2,
      bounds.worldBottom - bounds.worldTop + pad * 2,
    );
    g.fill({ color: 0xffffff, alpha: 1 });
    return g;
  }

  private redrawAll(scene: Scene): void {
    this.graphics.clear();
    const size = GRID_SIZE;
    const stroke = 1;
    for (const f of scene.floors) {
      const x = f.gridX * size;
      const y = f.gridY * size;
      this.graphics
        .rect(x, y, size, size)
        .fill({ color: this.fillColor, alpha: this.fillAlpha })
        .stroke({
          width: stroke,
          color: this.strokeColor,
          alpha: this.strokeAlpha,
          alignment: 0,
        });
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
