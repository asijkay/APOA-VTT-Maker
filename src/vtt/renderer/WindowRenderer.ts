import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../engine/Camera';
import type { Scene, Window as VttWindow, Wall } from '../scene/SceneTypes';

export class WindowRenderer {
  private container: Container;
  private graphics: Graphics;
  private dirty = true;
  private selectionIds: ReadonlySet<string> = new Set();

  private lastZoom = -1;
  private lastCamX = -Infinity;
  private lastCamY = -Infinity;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.name = 'windowLayer';
    parent.addChild(this.container);
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  getContainer(): Container { return this.container; }

  setSelection(ids: ReadonlySet<string>): void {
    if (this.selectionIds === ids) return;
    this.selectionIds = ids;
    this.dirty = true;
  }

  markDirty(): void { this.dirty = true; }

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
      this.dirty = true;
    }

    if (!this.dirty) return;
    this.graphics.clear();

    const CYAN = 0x00e5ff;
    const CYAN_SELECTED = 0x00ff80;

    for (const win of scene.windows) {
      const wall = scene.walls.find(w => w.id === win.wallId);
      if (!wall) continue;

      const { p1, p2 } = this.getWindowEndpoints(win, wall);
      const sp1 = camera.worldToScreen(p1.x, p1.y);
      const sp2 = camera.worldToScreen(p2.x, p2.y);

      const isSelected = this.selectionIds.has(win.id);
      const color = isSelected ? CYAN_SELECTED : CYAN;

      // Draw window as a thick dashed cyan line
      this.graphics.setStrokeStyle({ width: isSelected ? 5 : 3, color, alpha: 0.9 });
      this.graphics.beginPath();
      this.drawDashedLine(sp1.x, sp1.y, sp2.x, sp2.y, 8, 4);
      this.graphics.stroke();

      // Draw center marker
      const cx = (sp1.x + sp2.x) / 2;
      const cy = (sp1.y + sp2.y) / 2;
      this.graphics.setFillStyle({ color, alpha: 0.9 });
      this.graphics.beginPath();
      this.graphics.circle(cx, cy, 4);
      this.graphics.fill();
    }

    this.dirty = false;
  }

  private getWindowEndpoints(win: VttWindow, wall: Wall): { p1: { x: number; y: number }; p2: { x: number; y: number } } {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const wallLen = Math.sqrt(dx * dx + dy * dy);
    const normWidth = wallLen > 0 ? win.width / wallLen : 0;
    const start = Math.max(0, win.position - normWidth / 2);
    const end = Math.min(1, win.position + normWidth / 2);
    return {
      p1: { x: wall.x1 + dx * start, y: wall.y1 + dy * start },
      p2: { x: wall.x1 + dx * end, y: wall.y1 + dy * end },
    };
  }

  private drawDashedLine(x1: number, y1: number, x2: number, y2: number, dashLen: number, gapLen: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const total = Math.sqrt(dx * dx + dy * dy);
    if (total === 0) return;
    const ux = dx / total;
    const uy = dy / total;
    let pos = 0;
    let drawing = true;
    while (pos < total) {
      const segLen = Math.min(drawing ? dashLen : gapLen, total - pos);
      if (drawing) {
        this.graphics.moveTo(x1 + ux * pos, y1 + uy * pos);
        this.graphics.lineTo(x1 + ux * (pos + segLen), y1 + uy * (pos + segLen));
      }
      pos += segLen;
      drawing = !drawing;
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}
