import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../engine/Camera';
import type { VisionResult } from '../systems/VisionSystem';

export class VisionRenderer {
  private container: Container;
  private graphics: Graphics;
  private visionResults: VisionResult[] = [];
  private dirty = true;
  private debug = false;
  
  private lastZoom = -1;
  private lastCamX = -Infinity;
  private lastCamY = -Infinity;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.name = 'visionLayer';
    parent.addChild(this.container);

    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  getContainer(): Container {
    return this.container;
  }

  setVisionResults(results: VisionResult[]): void {
    this.visionResults = results;
    this.dirty = true;
  }
  
  setDebugMode(debug: boolean): void {
    if (this.debug === debug) return;
    this.debug = debug;
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  update(camera: Camera): void {
    const cs = camera.getState();
    const camChanged =
      cs.zoom !== this.lastZoom ||
      Math.abs(cs.x - this.lastCamX) > 0.05 ||
      Math.abs(cs.y - this.lastCamY) > 0.05;
    
    if (camChanged) {
      this.lastZoom = cs.zoom;
      this.lastCamX = cs.x;
      this.lastCamY = cs.y;
      this.dirty = true;
    }

    if (!this.dirty) return;

    this.graphics.clear();

    for (const result of this.visionResults) {
      if (result.polygon.length < 3) continue;

      this.graphics.beginPath();
      const p0 = camera.worldToScreen(result.polygon[0].x, result.polygon[0].y);
      this.graphics.moveTo(p0.x, p0.y);

      for (let i = 1; i < result.polygon.length; i++) {
        const p = camera.worldToScreen(result.polygon[i].x, result.polygon[i].y);
        this.graphics.lineTo(p.x, p.y);
      }

      this.graphics.closePath();
      
      this.graphics.fill({ color: 0xffffff, alpha: 0.15 });
      
      if (this.debug) {
        this.graphics.stroke({ width: 2, color: 0xff00ff, alpha: 0.8 });
      } else {
        this.graphics.stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
      }
    }

    this.dirty = false;
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}