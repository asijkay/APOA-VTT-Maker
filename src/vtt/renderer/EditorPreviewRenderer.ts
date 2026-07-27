import { Container, Graphics } from 'pixi.js';
import { GRID_SIZE } from '../engine/CoordinateSystem';

export type PreviewFloorCell = {
  gridX: number;
  gridY: number;
  elevation: number;
  mode: 'add' | 'remove';
};

export class EditorPreviewRenderer {
  private container: Container;
  private graphics: Graphics;

  constructor(stage: Container) {
    this.container = new Container();
    this.container.name = 'editor.previews';
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    stage.addChild(this.container);
  }

  clear(): void {
    this.graphics.clear();
  }

  showGridCursor(gx: number, gy: number, mode: 'add' | 'remove' | 'select'): void {
    this.graphics.clear();
    const size = GRID_SIZE;
    const x = gx * size;
    const y = gy * size;
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
      .rect(x, y, size, size)
      .fill({ color, alpha })
      .stroke({ width: 1, color: stroke, alpha: 0.95, alignment: 0 });
  }

  showCells(cells: PreviewFloorCell[]): void {
    this.graphics.clear();
    const size = GRID_SIZE;
    for (const c of cells) {
      const x = c.gridX * size;
      const y = c.gridY * size;
      const isAdd = c.mode === 'add';
      const color = isAdd ? 0xffe066 : 0xff4d4f;
      const alpha = isAdd ? 0.25 : 0.22;
      const stroke = isAdd ? 0xffe066 : 0xff4d4f;
      this.graphics
        .rect(x, y, size, size)
        .fill({ color, alpha })
        .stroke({ width: 1, color: stroke, alpha: 0.95, alignment: 0 });
    }
  }

  getContainer(): Container {
    return this.container;
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}
