import type { EditorTool } from '../../scene/SceneTypes';
import { cellCenter } from './PaintTools';
import type { EditorToolController, ToolContext, ToolPointerEvent } from '../EditorTool';
import { worldToGrid } from '../../engine/CoordinateSystem';
import { opAddToken } from '../../scene/UndoManager';

export class TokenTool implements EditorToolController {
  readonly id: EditorTool = 'token';
  private ctx?: ToolContext;
  private lastCell: { gx: number; gy: number } | null = null;

  attach(ctx: ToolContext): void {
    this.ctx = ctx;
  }

  deactivate(): void {
    this.ctx?.preview.clear();
    this.lastCell = null;
  }

  onPointer(e: ToolPointerEvent): void {
    if (!this.ctx) return;
    const { preview } = this.ctx;
    const { gridSize, mapWidth, mapHeight } = this.ctx.scene.snapshot();
    const rawG = worldToGrid({ x: e.worldX, y: e.worldY }, gridSize);
    const g = {
      gx: Math.max(0, Math.min(mapWidth - 1, rawG.gx)),
      gy: Math.max(0, Math.min(mapHeight - 1, rawG.gy)),
    };
    if (e.type === 'pointerdown' && e.button === 0) {
      const center = cellCenter(g.gx, g.gy, gridSize);
      this.ctx.undoManager.execute(opAddToken({ x: center.x, y: center.y, elevation: 0 }));
      preview.clear();
      this.lastCell = null;
      return;
    }
    if (e.type === 'pointermove') {
      if (!this.lastCell || this.lastCell.gx !== g.gx || this.lastCell.gy !== g.gy) {
        this.lastCell = g;
        preview.showGridCursor(g.gx, g.gy, 'add', gridSize);
      }
    }
  }
}
