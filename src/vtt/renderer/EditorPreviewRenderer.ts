import { Container, Graphics, Text } from 'pixi.js';
import type { Camera } from '../engine/Camera';
import { screenRect } from './FloorRenderer';

export type PreviewFloorCell = {
  gridX: number;
  gridY: number;
  elevation: number;
  mode: 'add' | 'remove';
};

export type PreviewWallSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  valid: boolean;
};

export class EditorPreviewRenderer {
  private container: Container;
  private graphics: Graphics;
  private rulerText: Text;
  private _camera: Camera | null = null;

  constructor(stage: Container) {
    this.container = new Container();
    this.container.name = 'editor.previews';
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.rulerText = new Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 14, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } });
    this.rulerText.anchor.set(0.5);
    this.rulerText.visible = false;
    this.container.addChild(this.rulerText);
    stage.addChild(this.container);
  }

  setCamera(camera: Camera): void {
    this._camera = camera;
  }

  clear(): void {
    this.graphics.clear();
    this.rulerText.visible = false;
  }

  private cam(): Camera {
    if (!this._camera) throw new Error('EditorPreviewRenderer used before camera assigned');
    return this._camera;
  }

  showGridCursor(gx: number, gy: number, mode: 'add' | 'remove' | 'select', gridSize: number): void {
    this.graphics.clear();
    const size = gridSize;
    const wx1 = gx * size;
    const wy1 = gy * size;
    const wx2 = wx1 + size;
    const wy2 = wy1 + size;
    const r = screenRect(this.cam(), wx1, wy1, wx2, wy2);
    let color = 0xffe066;
    let alpha = 0.25;
    let stroke = 0xffe066;
    if (mode === 'remove') {
      color = 0xff4d4f;
      alpha = 0.2;
      stroke = 0xff4d4f;
    } else if (mode === 'select') {
      color = 0x9ae6b4;
      alpha = 0.15;
      stroke = 0x9ae6b4;
    }
    this.graphics
      .rect(r.sx, r.sy, r.sw, r.sh)
      .fill({ color, alpha })
      .stroke({ width: 1, color: stroke, alpha: 0.95, alignment: 0 });
  }

  showCells(cells: PreviewFloorCell[], gridSize: number): void {
    this.graphics.clear();
    const size = gridSize;
    for (const c of cells) {
      const wx1 = c.gridX * size;
      const wy1 = c.gridY * size;
      const wx2 = wx1 + size;
      const wy2 = wy1 + size;
      const r = screenRect(this.cam(), wx1, wy1, wx2, wy2);
      const isAdd = c.mode === 'add';
      const color = isAdd ? 0xffe066 : 0xff4d4f;
      const alpha = isAdd ? 0.25 : 0.22;
      const stroke = isAdd ? 0xffe066 : 0xff4d4f;
      this.graphics
        .rect(r.sx, r.sy, r.sw, r.sh)
        .fill({ color, alpha })
        .stroke({ width: 1, color: stroke, alpha: 0.95, alignment: 0 });
    }
  }

  showWallSegment(seg: PreviewWallSegment): void {
    this.graphics.clear();
    const cam = this.cam();
    const color = seg.valid ? 0xffd27a : 0xff5557;
    const alpha = seg.valid ? 0.9 : 0.7;
    const p1 = cam.worldToScreen(seg.x1, seg.y1);
    const p2 = cam.worldToScreen(seg.x2, seg.y2);
    this.graphics
      .moveTo(p1.x, p1.y)
      .lineTo(p2.x, p2.y)
      .stroke({ width: seg.valid ? 4 : 2, color, alpha, alignment: 0.5 })
      .circle(p1.x, p1.y, 4)
      .fill({ color: 0xffffff, alpha: 0.95 })
      .stroke({ width: 1, color, alpha })
      .circle(p2.x, p2.y, 4)
      .fill({ color: 0xffffff, alpha: 0.95 })
      .stroke({ width: 1, color, alpha });
  }

  showSelectionBox(x1: number, y1: number, x2: number, y2: number): void {
    this.graphics.clear();
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);
    const p1 = this.cam().worldToScreen(minX, minY);
    const p2 = this.cam().worldToScreen(maxX, maxY);

    this.graphics
      .rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y)
      .fill({ color: 0x63b3ed, alpha: 0.15 })
      .stroke({ width: 1, color: 0x63b3ed, alpha: 0.8, alignment: 0 });
  }

  showRuler(x1: number, y1: number, x2: number, y2: number, text: string): void {
    this.graphics.clear();
    const cam = this.cam();
    const p1 = cam.worldToScreen(x1, y1);
    const p2 = cam.worldToScreen(x2, y2);
    
    this.graphics
      .moveTo(p1.x, p1.y)
      .lineTo(p2.x, p2.y)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.8, alignment: 0.5 })
      .circle(p1.x, p1.y, 4).fill(0xffffff)
      .circle(p2.x, p2.y, 4).fill(0xffffff);
      
    this.rulerText.text = text;
    this.rulerText.x = (p1.x + p2.x) / 2;
    this.rulerText.y = (p1.y + p2.y) / 2 - 15;
    this.rulerText.visible = true;
  }

  getContainer(): Container {
    return this.container;
  }

  destroy(): void {
    this.graphics.destroy();
    this.rulerText.destroy();
    this.container.destroy();
  }
}
