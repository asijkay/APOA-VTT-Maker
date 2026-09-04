import type { EditorToolController, ToolContext, ToolPointerEvent } from '../EditorTool';
import type { EditorTool } from '../../scene/SceneTypes';

export class RulerTool implements EditorToolController {
  readonly id: EditorTool = 'ruler';
  private ctx: ToolContext | null = null;
  private dragging = false;
  private startX = 0;
  private startY = 0;

  attach(ctx: ToolContext): void {
    this.ctx = ctx;
    this.ctx.selection.set(null);
  }

  deactivate(): void {
    this.dragging = false;
    this.ctx?.preview.clear();
    this.ctx = null;
  }

  onPointer(e: ToolPointerEvent): void {
    if (!this.ctx) return;

    if (e.type === 'pointerdown' && e.button === 0) {
      this.dragging = true;
      this.startX = e.worldX;
      this.startY = e.worldY;
      this.updateRuler(e.worldX, e.worldY);
      return;
    }

    if (e.type === 'pointermove' && this.dragging) {
      this.updateRuler(e.worldX, e.worldY);
      return;
    }

    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      if (this.dragging) {
        this.dragging = false;
        this.ctx.preview.clear();
      }
    }
  }

  onKey(_e: KeyboardEvent): void {}

  private updateRuler(endX: number, endY: number): void {
    if (!this.ctx) return;
    const dx = endX - this.startX;
    const dy = endY - this.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Convert to grid units
    const gridSize = this.ctx.scene.snapshot().gridSize;
    const units = (dist / gridSize).toFixed(1);
    const text = `${units} grids\n${Math.round(dist)} px`;
    
    this.ctx.preview.showRuler(this.startX, this.startY, endX, endY, text);
  }
}
