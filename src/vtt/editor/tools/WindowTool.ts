import type { EditorToolController, ToolContext, ToolPointerEvent } from '../EditorTool';
import type { EditorTool } from '../../scene/SceneTypes';
import { opRemoveWindow } from '../../scene/UndoManager';

/**
 * WindowTool: Click near a wall to place a window.
 * Windows always pass vision and light, but always block movement.
 */
export class WindowTool implements EditorToolController {
  readonly id: EditorTool = 'window';
  private ctx: ToolContext | null = null;
  private selectedWindowId: string | null = null;
  private isDragging = false;

  attach(ctx: ToolContext): void {
    this.ctx = ctx;
  }

  deactivate(): void {
    this.ctx = null;
    this.selectedWindowId = null;
    this.isDragging = false;
  }

  onPointer(e: ToolPointerEvent): void {
    if (!this.ctx) return;
    const { scene, selection, undoManager } = this.ctx;

    switch (e.type) {
      case 'pointerdown': {
        if (e.button !== 0) break;

        // Check if clicking on existing window
        const existing = this.findWindowAt(e.worldX, e.worldY);
        if (existing) {
          this.selectedWindowId = existing.id;
          selection.set(existing.id);
          this.isDragging = true;
          break;
        }

        // Find nearest wall
        const snapshot = scene.snapshot();
        const nearest = scene.findNearestWall(e.worldX, e.worldY, 30);
        if (!nearest) break;

        const wall = snapshot.walls.find(w => w.id === nearest.id);
        if (!wall) break;

        // Compute normalized position
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) break;
        let t = ((e.worldX - wall.x1) * dx + (e.worldY - wall.y1) * dy) / lenSq;
        t = Math.max(0.05, Math.min(0.95, t));

        let createdId: string | undefined;
        undoManager.execute({
          label: 'Add Window',
          apply(store) { createdId = store.addWindow({ wallId: wall.id, position: t, width: 40 })?.id; },
          inverse(store) { if (createdId) store.removeWindow(createdId); },
        });
        if (createdId) {
          this.selectedWindowId = createdId;
          selection.set(createdId);
        }
        break;
      }

      case 'pointermove': {
        if (!this.isDragging || !this.selectedWindowId) break;
        const win = scene.findWindowById(this.selectedWindowId);
        if (!win) break;
        const snapshot = scene.snapshot();
        const wall = snapshot.walls.find(w => w.id === win.wallId);
        if (!wall) break;
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) break;
        let t = ((e.worldX - wall.x1) * dx + (e.worldY - wall.y1) * dy) / lenSq;
        t = Math.max(0.05, Math.min(0.95, t));
        scene.updateWindow(this.selectedWindowId, { position: t });
        break;
      }

      case 'pointerup':
      case 'pointercancel':
        this.isDragging = false;
        break;
    }
  }

  onKey(e: KeyboardEvent): void {
    if (!this.ctx || !this.selectedWindowId) return;
    const { scene, selection, undoManager } = this.ctx;
    const win = scene.findWindowById(this.selectedWindowId);
    if (!win) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      undoManager.execute(opRemoveWindow(win.id, { wallId: win.wallId, position: win.position, width: win.width }));
      this.selectedWindowId = null;
      selection.set(null);
      e.preventDefault();
    }
  }

  private findWindowAt(x: number, y: number) {
    if (!this.ctx) return null;
    const snapshot = this.ctx.scene.snapshot();
    for (const win of snapshot.windows) {
      const wall = snapshot.walls.find(w => w.id === win.wallId);
      if (!wall) continue;
      const cx = wall.x1 + (wall.x2 - wall.x1) * win.position;
      const cy = wall.y1 + (wall.y2 - wall.y1) * win.position;
      const dx = x - cx;
      const dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) < win.width / 2 + 8) return win;
    }
    return null;
  }
}
