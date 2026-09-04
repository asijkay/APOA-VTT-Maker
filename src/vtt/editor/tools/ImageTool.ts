import type { EditorToolController, ToolContext, ToolPointerEvent } from '../EditorTool';
import type { EditorTool } from '../../scene/SceneTypes';

export class ImageTool implements EditorToolController {
  readonly id: EditorTool = 'image';
  private ctx: ToolContext | null = null;

  attach(ctx: ToolContext): void {
    this.ctx = ctx;
  }

  deactivate(): void {
    this.ctx = null;
  }

  onPointer(e: ToolPointerEvent): void {
    if (!this.ctx) return;
    if (e.type !== 'pointerdown' || e.button !== 0) return;
    
    // Only GM can use ImageTool (redundant with viewMode checks but safe)
    if (this.ctx.viewMode !== 'gm') return;
    
    const { undoManager, selection } = this.ctx;

    let createdId: string | undefined;
    undoManager.execute({
      label: 'Add Image',
      apply(store) {
        createdId = store.addImage({
          url: 'https://pixijs.com/assets/bunny.png', // Temporary default placeholder
          x: e.worldX,
          y: e.worldY,
          width: 500,
          height: 500,
          opacity: 1,
          locked: false,
        }).id;
      },
      inverse(store) {
        if (createdId) store.removeImage(createdId);
      },
    });

    if (createdId) {
      selection.set(createdId);
    }
  }

  onKey(_e: KeyboardEvent): void {}
}
