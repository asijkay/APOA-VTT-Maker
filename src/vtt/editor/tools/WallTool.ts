import { snapWorldToGrid } from '../../engine/CoordinateSystem';
import type { EditorTool } from '../../scene/SceneTypes';
import type { EditorToolController, ToolContext, ToolPointerEvent } from '../EditorTool';
import type { PreviewWallSegment } from '../../renderer/EditorPreviewRenderer';

export function snapToGridIntersection(wx: number, wy: number): { x: number; y: number } {
  return snapWorldToGrid({ x: wx, y: wy });
}

/**
 * Given two raw world endpoints (not yet snapped), returns a pair of axis-aligned
 * endpoints where start is already snapped to grid, and end is snapped to grid
 * and locked horizontally or vertically based on larger world delta.
 *
 * If startX == endX AND startY == endY after locking, returns valid = false.
 */
export function lockAxisAligned(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): { x1: number; y1: number; x2: number; y2: number; valid: boolean } {
  const rawStart = snapToGridIntersection(startX, startY);
  const rawEnd = snapToGridIntersection(endX, endY);
  const dx = Math.abs(rawEnd.x - rawStart.x);
  const dy = Math.abs(rawEnd.y - rawStart.y);
  const horizontal = dx >= dy;
  const x1 = rawStart.x;
  const y1 = rawStart.y;
  let x2: number;
  let y2: number;
  if (horizontal) {
    x2 = rawEnd.x;
    y2 = y1;
  } else {
    x2 = x1;
    y2 = rawEnd.y;
  }
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
    const { preview, scene } = this.ctx;

    if (e.type === 'pointerdown') {
      this.dragging = true;
      const s = snapToGridIntersection(e.worldX, e.worldY);
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
      if (!this.dragging || !this.startWorld) {
        const s = snapToGridIntersection(e.worldX, e.worldY);
        preview.showWallSegment({ x1: s.x, y1: s.y, x2: s.x, y2: s.y, valid: false });
        return;
      }
      const seg = lockAxisAligned(
        this.startWorld.x,
        this.startWorld.y,
        e.worldX,
        e.worldY,
      );
      preview.showWallSegment(seg);
      return;
    }

    if (e.type === 'pointerup') {
      if (this.dragging && this.startWorld) {
        const seg = lockAxisAligned(
          this.startWorld.x,
          this.startWorld.y,
          e.worldX,
          e.worldY,
        );
        if (seg.valid) {
          scene.addWall({
            x1: seg.x1,
            y1: seg.y1,
            x2: seg.x2,
            y2: seg.y2,
            elevation: 0,
            blocksVision: true,
            blocksMovement: true,
          });
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
