import type { Camera } from '../../engine/Camera';
import { GRID_SIZE, worldToGrid, type Point2 } from '../../engine/CoordinateSystem';
import type { EditorTool } from '../../scene/SceneTypes';
import type { EditorToolController, ToolContext, ToolPointerEvent } from '../EditorTool';
import type { PreviewFloorCell } from '../../renderer/EditorPreviewRenderer';

export function screenCell(sx: number, sy: number, camera: Camera): { gx: number; gy: number } {
  const w = camera.screenToWorld(sx, sy);
  return worldToGrid(w);
}

abstract class FloorFamilyTool implements EditorToolController {
  protected ctx?: ToolContext;
  protected isDragging = false;
  protected dragStartCell: { gx: number; gy: number } | null = null;
  protected lastTouched = new Set<string>();
  abstract readonly id: EditorTool;
  protected abstract touchCell(gx: number, gy: number): 'add' | 'remove' | void;
  protected abstract previewModeFor(gx: number, gy: number): 'add' | 'remove';

  attach(ctx: ToolContext): void {
    this.ctx = ctx;
  }

  deactivate(): void {
    this.isDragging = false;
    this.dragStartCell = null;
    this.lastTouched.clear();
    this.ctx?.preview.clear();
  }

  onPointer(e: ToolPointerEvent): void {
    if (!this.ctx) return;
    const { camera, preview } = this.ctx;
    const cell = screenCell(e.screenX, e.screenY, camera);

    if (e.type === 'pointerdown') {
      this.isDragging = true;
      this.dragStartCell = cell;
      this.lastTouched.clear();
      this.touchLine(cell, cell);
      return;
    }

    if (e.type === 'pointermove') {
      if (this.isDragging && this.dragStartCell) {
        this.touchLine(this.dragStartCell, cell);
      } else {
        preview.showGridCursor(cell.gx, cell.gy, this.previewModeFor(cell.gx, cell.gy));
      }
      return;
    }

    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      if (this.isDragging && this.dragStartCell) {
        this.touchLine(this.dragStartCell, cell);
      }
      this.isDragging = false;
      this.dragStartCell = null;
      this.lastTouched.clear();
      preview.showGridCursor(cell.gx, cell.gy, this.previewModeFor(cell.gx, cell.gy));
    }
  }

  private touchLine(from: { gx: number; gy: number }, to: { gx: number; gy: number }): void {
    if (!this.ctx) return;
    const { preview, scene } = this.ctx;
    const cells = rasterizeLineCells(from.gx, from.gy, to.gx, to.gy);
    const pending: Array<{ gx: number; gy: number; mode: 'add' | 'remove' }> = [];
    const batch: Array<{ gridX: number; gridY: number; elevation?: number }> = [];
    const removeBatch: Array<{ gridX: number; gridY: number; elevation?: number }> = [];

    for (const c of cells) {
      const key = `${c.gx},${c.gy}`;
      if (this.lastTouched.has(key)) {
        continue;
      }
      this.lastTouched.add(key);
      const mode = this.touchCell(c.gx, c.gy);
      if (!mode) continue;
      pending.push({ gx: c.gx, gy: c.gy, mode });
      if (mode === 'add') batch.push({ gridX: c.gx, gridY: c.gy, elevation: 0 });
      else removeBatch.push({ gridX: c.gx, gridY: c.gy, elevation: 0 });
    }
    if (batch.length) scene.addFloorTilesBulk(batch);
    if (removeBatch.length) scene.removeFloorTilesBulkAt(removeBatch);
    if (pending.length) {
      const previewCells: PreviewFloorCell[] = pending.map((c) => ({
        gridX: c.gx,
        gridY: c.gy,
        elevation: 0,
        mode: c.mode,
      }));
      preview.showCells(previewCells);
    }
  }
}

export function rasterizeLineCells(
  gx0: number,
  gy0: number,
  gx1: number,
  gy1: number,
): Array<{ gx: number; gy: number }> {
  const out: Array<{ gx: number; gy: number }> = [];
  let x = gx0;
  let y = gy0;
  const dx = Math.abs(gx1 - gx0);
  const dy = Math.abs(gy1 - gy0);
  const sx = gx0 < gx1 ? 1 : -1;
  const sy = gy0 < gy1 ? 1 : -1;
  let err = dx - dy;
  const maxSteps = (dx + dy + 1) * 2;
  let steps = 0;
  while (steps++ < maxSteps) {
    out.push({ gx: x, gy: y });
    if (x === gx1 && y === gy1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

export class FloorTool extends FloorFamilyTool {
  readonly id: EditorTool = 'floor';

  protected touchCell(gx: number, gy: number): 'add' | void {
    void gx;
    void gy;
    return 'add';
  }

  protected previewModeFor(_gx: number, _gy: number): 'add' | 'remove' {
    return 'add';
  }
}

export class EraseFloorTool extends FloorFamilyTool {
  readonly id: EditorTool = 'erase-floor';

  protected touchCell(gx: number, gy: number): 'remove' | void {
    const found = this.ctx?.scene.findFloorByCell(gx, gy, 0);
    return found ? 'remove' : undefined;
  }

  protected previewModeFor(gx: number, gy: number): 'add' | 'remove' {
    const found = this.ctx?.scene.findFloorByCell(gx, gy, 0);
    return found ? 'remove' : 'add';
  }
}

export class SelectTool implements EditorToolController {
  readonly id: EditorTool = 'select';
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
    const w: Point2 = { x: e.worldX, y: e.worldY };
    void w;
    const g = worldToGrid({ x: e.worldX, y: e.worldY });
    if (!this.lastCell || this.lastCell.gx !== g.gx || this.lastCell.gy !== g.gy) {
      this.lastCell = g;
      if (e.type !== 'pointerup' && e.type !== 'pointercancel') {
        this.ctx.preview.showGridCursor(g.gx, g.gy, 'select');
      }
    }
  }
}

export function cellCenter(gx: number, gy: number): Point2 {
  return { x: gx * GRID_SIZE + GRID_SIZE / 2, y: gy * GRID_SIZE + GRID_SIZE / 2 };
}
