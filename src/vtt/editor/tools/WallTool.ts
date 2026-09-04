import { snapWorldToGrid } from '../../engine/CoordinateSystem';
import type { EditorTool } from '../../scene/SceneTypes';
import type { EditorToolController, ToolContext, ToolPointerEvent } from '../EditorTool';
import type { PreviewWallSegment } from '../../renderer/EditorPreviewRenderer';
import { opAddWall } from '../../scene/UndoManager';

export function snapToGridIntersection(wx: number, wy: number, gridSize: number): { x: number; y: number } {
  return snapWorldToGrid({ x: wx, y: wy }, gridSize);
}

export function snapWallEndpoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  gridSize: number,
  mapWidth: number,
  mapHeight: number,
): { x1: number; y1: number; x2: number; y2: number; valid: boolean } {
  const rawStart = snapToGridIntersection(startX, startY, gridSize);
  const rawEnd = snapToGridIntersection(endX, endY, gridSize);
  
  const clampX = (x: number) => Math.max(0, Math.min(mapWidth * gridSize, x));
  const clampY = (y: number) => Math.max(0, Math.min(mapHeight * gridSize, y));
  
  const x1 = clampX(rawStart.x);
  const y1 = clampY(rawStart.y);
  const x2 = clampX(rawEnd.x);
  const y2 = clampY(rawEnd.y);
  const valid = !(x1 === x2 && y1 === y2);
  return { x1, y1, x2, y2, valid };
}

export class WallTool implements EditorToolController {
  readonly id: EditorTool = 'wall';
  protected ctx?: ToolContext;
  private dragging = false;
  private startWorld: { x: number; y: number } | null = null;

  attach(ctx: ToolContext): void {
    this.ctx = ctx;
    this.ctx.selection.set(null);
  }

  deactivate(): void {
    this.dragging = false;
    this.startWorld = null;
    this.ctx?.preview.clear();
  }

  onPointer(e: ToolPointerEvent): void {
    if (!this.ctx) return;
    const { preview } = this.ctx;

    if (e.type === 'pointerdown') {
      this.dragging = true;
      const gridSize = this.ctx.scene.snapshot().gridSize;
      const s = snapToGridIntersection(e.worldX, e.worldY, gridSize);
      this.startWorld = s;
      const previewSeg: PreviewWallSegment = {
        x1: s.x,
        y1: s.y,
        x2: s.x,
        y2: s.y,
        valid: false,
      };
      preview.showWallSegment(previewSeg);
      return;
    }

    if (e.type === 'pointermove') {
      const { gridSize, mapWidth, mapHeight } = this.ctx.scene.snapshot();
      if (!this.dragging || !this.startWorld) {
        const s = snapToGridIntersection(e.worldX, e.worldY, gridSize);
        preview.showWallSegment({ x1: s.x, y1: s.y, x2: s.x, y2: s.y, valid: false });
        return;
      }
      const seg = snapWallEndpoints(
        this.startWorld.x,
        this.startWorld.y,
        e.worldX,
        e.worldY,
        gridSize,
        mapWidth,
        mapHeight,
      );
      preview.showWallSegment(seg);
      return;
    }

    if (e.type === 'pointerup') {
      if (this.dragging && this.startWorld) {
        const { gridSize, mapWidth, mapHeight } = this.ctx.scene.snapshot();
        const seg = snapWallEndpoints(
          this.startWorld.x,
          this.startWorld.y,
          e.worldX,
          e.worldY,
          gridSize,
          mapWidth,
          mapHeight,
        );
        if (seg.valid) {
          this.ctx.undoManager.execute(opAddWall({
            x1: seg.x1,
            y1: seg.y1,
            x2: seg.x2,
            y2: seg.y2,
            elevation: 0,
            blocksVision: true,
            blocksMovement: true,
          }));
        }
      }
      this.dragging = false;
      this.startWorld = null;
      preview.clear();
      return;
    }

    if (e.type === 'pointercancel') {
      this.dragging = false;
      this.startWorld = null;
      preview.clear();
    }
  }
}
