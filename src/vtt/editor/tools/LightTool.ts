import type { EditorToolController, ToolContext, ToolPointerEvent } from '../EditorTool';
import type { EditorTool } from '../../scene/SceneTypes';

export class LightTool implements EditorToolController {
  id: EditorTool = 'light';
  private ctx: ToolContext | null = null;
  private selectedLightId: string | null = null;

  attach(ctx: ToolContext): void {
    this.ctx = ctx;
  }

  deactivate(): void {
    this.ctx = null;
    this.selectedLightId = null;
  }

  onPointer(e: ToolPointerEvent): void {
    if (!this.ctx) return;

    const { scene, selection } = this.ctx;

    switch (e.type) {
      case 'pointerdown':
        if (e.button === 0) {
          // Check if clicking on existing light
          const light = this.findLightAt(e.worldX, e.worldY);
          if (light) {
            // Select the light
            this.selectedLightId = light.id;
            selection.set(light.id);
          } else {
            // Place new light
            const result = scene.addLight({
              x: e.worldX,
              y: e.worldY,
              color: '#FFFFFF',
              radius: 150,
            });
            if (result) {
              this.selectedLightId = result.id;
              selection.set(result.id);
            }
          }
        }
        break;

      case 'pointerup':
        // Handle light dragging if needed
        break;

      case 'pointercancel':
        break;
    }
  }

  onKey(e: KeyboardEvent): void {
    if (!this.ctx || !this.selectedLightId) return;

    const { scene } = this.ctx;
    const light = scene.findLightById(this.selectedLightId);
    if (!light) return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        scene.removeLight(this.selectedLightId);
        this.selectedLightId = null;
        this.ctx.selection.set(null);
        e.preventDefault();
        break;
      case ' ':
      case 'Enter':
        // Toggle light enabled state
        scene.updateLight(this.selectedLightId, { enabled: !light.enabled });
        e.preventDefault();
        break;
    }
  }

  private findLightAt(x: number, y: number) {
    if (!this.ctx) return null;
    const { scene } = this.ctx;
    const snapshot = scene.snapshot();
    
    for (const light of snapshot.lights) {
      const dx = x - light.x;
      const dy = y - light.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Click tolerance: 20 world units
      if (dist < 20) {
        return light;
      }
    }
    return null;
  }
}