import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../engine/Camera';
import type { LightResult } from '../systems/LightingSystem';
import type { Scene } from '../scene/SceneTypes';

export class LightRenderer {
  private container: Container;
  private graphics: Graphics;
  private lightResults: LightResult[] = [];
  private selectionId: string | null = null;
  private dirty = true;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.name = 'lightLayer';
    parent.addChild(this.container);

    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  getContainer(): Container {
    return this.container;
  }

  setSelection(id: string | null): void {
    this.selectionId = id;
    this.dirty = true;
  }

  setLightResults(results: LightResult[]): void {
    this.lightResults = results;
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  private lastZoom = -1;
  private lastCamX = -Infinity;
  private lastCamY = -Infinity;

  update(scene: Scene, camera: Camera, selectionId: string | null): void {
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

    if (!this.dirty && this.selectionId === selectionId) return;
    
    this.selectionId = selectionId;
    this.graphics.clear();

    // Render each light as a colored radial gradient/polygon
    for (const result of this.lightResults) {
      if (result.polygon.length < 3) continue;

      this.graphics.beginPath();
      const p0 = camera.worldToScreen(result.polygon[0].x, result.polygon[0].y);
      this.graphics.moveTo(p0.x, p0.y);

      for (let i = 1; i < result.polygon.length; i++) {
        const p = camera.worldToScreen(result.polygon[i].x, result.polygon[i].y);
        this.graphics.lineTo(p.x, p.y);
      }

      this.graphics.closePath();
      
      // Parse color and create fill with alpha
      const color = this.parseColor(result.color);
      this.graphics.fill({ color, alpha: 0.3 });
      
      // Optional: stroke with thin line of same color
      this.graphics.stroke({ width: 1, color, alpha: 0.5 });

      // Draw selection highlight
      if (result.lightId === selectionId) {
        const light = scene.lights.find(l => l.id === result.lightId);
        if (light) {
          const sp = camera.worldToScreen(light.x, light.y);
          this.graphics.setStrokeStyle({ width: 2, color: 0x00FF00 }); // Green highlight
          this.graphics.beginPath();
          this.graphics.arc(sp.x, sp.y, 15, 0, Math.PI * 2);
          this.graphics.stroke();
        }
      }
    }

    this.dirty = false;
  }

  private parseColor(colorStr: string): number {
    // Handle hex colors
    if (colorStr.startsWith('#')) {
      return parseInt(colorStr.slice(1), 16);
    }
    
    // Handle named colors (simplified)
    const namedColors: Record<string, number> = {
      'red': 0xFF0000,
      'green': 0x00FF00,
      'blue': 0x0000FF,
      'yellow': 0xFFFF00,
      'orange': 0xFFA500,
      'purple': 0x800080,
      'white': 0xFFFFFF,
      'cyan': 0x00FFFF,
      'magenta': 0xFF00FF,
    };
    
    const lower = colorStr.toLowerCase();
    if (namedColors[lower]) {
      return namedColors[lower];
    }
    
    // Default to white
    return 0xFFFFFF;
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}