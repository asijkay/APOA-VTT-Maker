import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../engine/Camera';

export class AmbientLightRenderer {
  private container: Container;
  private graphics: Graphics;
  private dirty = true;
  private ambientLevel = 1.0;
  private ambientColor = '#ffffff';

  private lastZoom = -1;
  private lastCamX = -Infinity;
  private lastCamY = -Infinity;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.name = 'ambientLightLayer';
    parent.addChild(this.container);

    this.graphics = new Graphics();
    this.graphics.blendMode = 'multiply';
    this.container.addChild(this.graphics);
  }

  getContainer(): Container {
    return this.container;
  }

  setAmbientLight(level: number, color: string): void {
    if (this.ambientLevel === level && this.ambientColor === color) return;
    this.ambientLevel = level;
    this.ambientColor = color;
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  update(camera: Camera): void {
    const cs = camera.getState();
    const bounds = camera.getBounds();
    const camChanged =
      cs.zoom !== this.lastZoom ||
      Math.abs(cs.x - this.lastCamX) > 0.5 ||
      Math.abs(cs.y - this.lastCamY) > 0.5;

    if (!this.dirty && !camChanged) return;

    if (camChanged) {
      this.lastZoom = cs.zoom;
      this.lastCamX = cs.x;
      this.lastCamY = cs.y;
    }

    this.graphics.clear();

    const baseColor = this.parseColor(this.ambientColor);
    
    // Mix baseColor with white based on ambientLevel
    const r = (baseColor >> 16) & 0xFF;
    const g = (baseColor >> 8) & 0xFF;
    const b = baseColor & 0xFF;

    const finalR = Math.round(r + (255 - r) * this.ambientLevel);
    const finalG = Math.round(g + (255 - g) * this.ambientLevel);
    const finalB = Math.round(b + (255 - b) * this.ambientLevel);

    const finalColor = (finalR << 16) | (finalG << 8) | finalB;

    const vpW = bounds.viewportWidth;
    const vpH = bounds.viewportHeight;
    const topLeft = camera.screenToWorld(0, 0);
    const btmRight = camera.screenToWorld(vpW, vpH);

    const sp = camera.worldToScreen(topLeft.x, topLeft.y);
    const sp2 = camera.worldToScreen(btmRight.x, btmRight.y);

    this.graphics.rect(sp.x, sp.y, sp2.x - sp.x, sp2.y - sp.y);
    this.graphics.fill({ color: finalColor, alpha: 1.0 });

    this.dirty = false;
  }

  private parseColor(colorStr: string): number {
    if (colorStr.startsWith('#')) return parseInt(colorStr.slice(1), 16);
    return 0xFFFFFF; // default white
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}
