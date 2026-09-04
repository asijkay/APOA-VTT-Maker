import type { EditorToolController, ToolContext, ToolPointerEvent } from '../EditorTool';
import type { EditorTool } from '../../scene/SceneTypes';
import { worldToGrid, cellCenter } from '../../engine/CoordinateSystem';
import { resolveCircleAgainstSceneWalls } from '../../geometry/collision';
import { opBatch } from '../../scene/UndoManager';
import type { Operation } from '../../scene/UndoManager';

type DragObject = {
  type: 'token' | 'light' | 'door' | 'window' | 'image';
  id: string;
  offX: number;
  offY: number;
  startX: number;
  startY: number;
  radius?: number; // for token collision
};

export class SelectTool implements EditorToolController {
  readonly id: EditorTool = 'select';
  private ctx: ToolContext | null = null;
  private lastCell: { gx: number; gy: number } | null = null;

  private dragContext: {
    mode: 'drag_objects' | 'box_select';
    startX: number;
    startY: number;
    moved: boolean;
    objects: DragObject[];
  } | null = null;

  attach(ctx: ToolContext): void {
    this.ctx = ctx;
  }

  deactivate(): void {
    this.ctx?.preview.clear();
    this.lastCell = null;
    this.dragContext = null;
  }

  onPointer(e: ToolPointerEvent): void {
    if (!this.ctx) return;
    const gridSize = this.ctx.scene.snapshot().gridSize;
    const g = worldToGrid({ x: e.worldX, y: e.worldY }, gridSize);

    if (e.type === 'pointerdown' && e.button === 0) {
      if (this.ctx.viewMode === 'player') {
        this.ctx.selection.clear();
        this.dragContext = null;
        return;
      }

      // 1. Try to find an object under cursor
      const hit = this.findObjectUnderCursor(e.worldX, e.worldY);
      
      if (hit) {
        // If shift clicked, toggle selection
        if (e.shiftKey) {
          this.ctx.selection.toggle(hit.id);
        } else {
          // If clicked object is not in selection, replace selection
          if (!this.ctx.selection.has(hit.id)) {
            this.ctx.selection.setSingle(hit.id);
          }
        }
        
        // Prepare to drag all selected objects
        const selectedIds = this.ctx.selection.get();
        if (selectedIds.has(hit.id)) {
          const objects: DragObject[] = [];
          for (const sid of selectedIds) {
            const obj = this.getObjectDataForDrag(sid, e.worldX, e.worldY);
            if (obj) objects.push(obj);
          }
          
          if (objects.length > 0) {
            this.dragContext = {
              mode: 'drag_objects',
              startX: e.worldX,
              startY: e.worldY,
              moved: false,
              objects
            };
          }
        }
        return;
      }

      // 2. Try walls
      const wallHit = this.ctx.scene.findNearestWall(e.worldX, e.worldY, 25, 0);
      if (wallHit) {
        if (e.shiftKey) this.ctx.selection.toggle(wallHit.id);
        else this.ctx.selection.setSingle(wallHit.id);
        this.dragContext = null;
        return;
      }

      // 3. Clicked on empty space -> start box select
      if (!e.shiftKey) {
        this.ctx.selection.clear();
      }
      this.dragContext = {
        mode: 'box_select',
        startX: e.worldX,
        startY: e.worldY,
        moved: false,
        objects: []
      };
      return;
    }

    if (e.type === 'pointermove') {
      if (this.dragContext?.mode === 'drag_objects') {
        const cx = e.worldX;
        const cy = e.worldY;
        const moved = Math.abs(cx - this.dragContext.startX) > 1e-3 || Math.abs(cy - this.dragContext.startY) > 1e-3;
        if (moved) this.dragContext.moved = true;
        
        // If dragging multiple items, we disable collision for now to prevent getting stuck
        const disableCollision = this.dragContext.objects.length > 1;

        for (const obj of this.dragContext.objects) {
          const targetX = cx - obj.offX;
          const targetY = cy - obj.offY;

          if (obj.type === 'token') {
            let tx = targetX, ty = targetY;
            if (!disableCollision && obj.radius) {
              const currentToken = this.ctx.scene.findTokenById(obj.id);
              if (currentToken) {
                const dx = targetX - currentToken.x;
                const dy = targetY - currentToken.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const stepSize = Math.max(5, obj.radius / 2);
                const steps = Math.ceil(dist / stepSize);
                tx = currentToken.x; ty = currentToken.y;
                if (steps > 0) {
                  const stepX = dx / steps;
                  const stepY = dy / steps;
                  for (let i = 0; i < steps; i++) {
                    tx += stepX; ty += stepY;
                    const resolved = resolveCircleAgainstSceneWalls(tx, ty, obj.radius, this.ctx.scene.snapshot(), { elevation: 0 });
                    tx = resolved.x; ty = resolved.y;
                  }
                }
              }
            }
            this.ctx.scene.updateToken(obj.id, { x: tx, y: ty });
          } else if (obj.type === 'light') {
            this.ctx.scene.updateLight(obj.id, { x: targetX, y: targetY });
          } else if (obj.type === 'image') {
            this.ctx.scene.updateImage(obj.id, { x: targetX, y: targetY });
          } else if (obj.type === 'door' || obj.type === 'window') {
            const db = obj.type === 'door' ? this.ctx.scene.findDoorById(obj.id) : this.ctx.scene.findWindowById(obj.id);
            if (db) {
              const wall = this.ctx.scene.findWallById(db.wallId);
              if (wall) {
                const dx = wall.x2 - wall.x1;
                const dy = wall.y2 - wall.y1;
                const lenSq = dx * dx + dy * dy;
                if (lenSq > 0) {
                  let t = ((cx - wall.x1) * dx + (cy - wall.y1) * dy) / lenSq;
                  t = Math.max(0, Math.min(1, t));
                  if (obj.type === 'door') this.ctx.scene.updateDoor(obj.id, { position: t });
                  else this.ctx.scene.updateWindow(obj.id, { position: t });
                }
              }
            }
          }
        }
        return;
      }

      if (this.dragContext?.mode === 'box_select') {
        const moved = Math.abs(e.worldX - this.dragContext.startX) > 2 || Math.abs(e.worldY - this.dragContext.startY) > 2;
        if (moved) {
          this.dragContext.moved = true;
          this.ctx.preview.showSelectionBox(this.dragContext.startX, this.dragContext.startY, e.worldX, e.worldY);
        }
        return;
      }

      if (!this.lastCell || this.lastCell.gx !== g.gx || this.lastCell.gy !== g.gy) {
        this.lastCell = g;
        this.ctx.preview.showGridCursor(g.gx, g.gy, 'select', this.ctx.scene.snapshot().gridSize);
      }
      return;
    }

    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      if (this.dragContext?.mode === 'box_select') {
        this.ctx.preview.clear();
        if (this.dragContext.moved) {
          const minX = Math.min(this.dragContext.startX, e.worldX);
          const minY = Math.min(this.dragContext.startY, e.worldY);
          const maxX = Math.max(this.dragContext.startX, e.worldX);
          const maxY = Math.max(this.dragContext.startY, e.worldY);
          
          const inBox = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
          
          const newSelected = new Set(e.shiftKey ? Array.from(this.ctx.selection.get()) : []);
          
          // Select tokens
          for (const t of this.ctx.scene.snapshot().tokens) {
            if (inBox(t.x, t.y)) newSelected.add(t.id);
          }
          // Select lights
          for (const l of this.ctx.scene.snapshot().lights) {
            if (inBox(l.x, l.y)) newSelected.add(l.id);
          }
          // Select images
          for (const m of this.ctx.scene.snapshot().images) {
            if (!m.locked && inBox(m.x, m.y)) newSelected.add(m.id);
          }
          // Select walls (if both endpoints are in box, or center)
          for (const w of this.ctx.scene.snapshot().walls) {
            const cx = (w.x1 + w.x2) / 2;
            const cy = (w.y1 + w.y2) / 2;
            if (inBox(cx, cy)) newSelected.add(w.id);
          }
          
          this.ctx.selection.set(newSelected);
        }
      } else if (this.dragContext?.mode === 'drag_objects' && this.dragContext.moved) {
        const ops: Operation[] = [];
        
        for (const obj of this.dragContext.objects) {
          if (obj.type === 'token') {
            const t = this.ctx.scene.findTokenById(obj.id);
            if (t) {
              if (this.ctx.snapTokens) {
                const gridSize = this.ctx.scene.snapshot().gridSize;
                const gx = Math.floor(t.x / gridSize);
                const gy = Math.floor(t.y / gridSize);
                const snapped = cellCenter(gx, gy, gridSize);
                this.ctx.scene.updateToken(obj.id, { x: snapped.x, y: snapped.y });
              }
              const finalT = this.ctx.scene.findTokenById(obj.id)!;
              const { startX, startY, id } = obj;
              ops.push({
                label: 'Move Token',
                apply: (s) => s.updateToken(id, { x: finalT.x, y: finalT.y }),
                inverse: (s) => s.updateToken(id, { x: startX, y: startY }),
              });
            }
          } else if (obj.type === 'light') {
            const finalLight = this.ctx.scene.findLightById(obj.id);
            if (finalLight) {
              const { startX, startY, id } = obj;
              ops.push({
                label: 'Move Light',
                apply: (s) => s.updateLight(id, { x: finalLight.x, y: finalLight.y }),
                inverse: (s) => s.updateLight(id, { x: startX, y: startY }),
              });
            }
          } else if (obj.type === 'image') {
            const finalImg = this.ctx.scene.findImageById(obj.id);
            if (finalImg) {
              const { startX, startY, id } = obj;
              ops.push({
                label: 'Move Image',
                apply: (s) => s.updateImage(id, { x: finalImg.x, y: finalImg.y }),
                inverse: (s) => s.updateImage(id, { x: startX, y: startY }),
              });
            }
          } else if (obj.type === 'door') {
            const finalDoor = this.ctx.scene.findDoorById(obj.id);
            if (finalDoor) {
              const { startX, id } = obj;
              ops.push({
                label: 'Move Door',
                apply: (s) => s.updateDoor(id, { position: finalDoor.position }),
                inverse: (s) => s.updateDoor(id, { position: startX }),
              });
            }
          } else if (obj.type === 'window') {
            const finalWin = this.ctx.scene.findWindowById(obj.id);
            if (finalWin) {
              const { startX, id } = obj;
              ops.push({
                label: 'Move Window',
                apply: (s) => s.updateWindow(id, { position: finalWin.position }),
                inverse: (s) => s.updateWindow(id, { position: startX }),
              });
            }
          }
        }
        
        if (ops.length > 0) {
          this.ctx.undoManager.pushOperation(opBatch('Move Objects', ops));
        }
      }
      this.dragContext = null;
    }
  }

  private findObjectUnderCursor(x: number, y: number): { type: string, id: string } | null {
    if (!this.ctx) return null;
    
    const tok = this.ctx.scene.findTokenNear(x, y, 30, 0);
    if (tok) return { type: 'token', id: tok.id };
    
    const light = this.ctx.scene.findLightNear(x, y, 20);
    if (light) return { type: 'light', id: light.id };
    
    const door = this.ctx.scene.findDoorNear(x, y, 20);
    if (door) return { type: 'door', id: door.id };
    
    const win = this.ctx.scene.findWindowNear(x, y, 20);
    if (win) return { type: 'window', id: win.id };
    
    const img = this.ctx.scene.findImageNear(x, y);
    if (img) {
      const m = this.ctx.scene.findImageById(img.id);
      if (m && !m.locked) return { type: 'image', id: img.id };
    }
    
    return null;
  }

  private getObjectDataForDrag(id: string, pointerX: number, pointerY: number): DragObject | null {
    if (!this.ctx) return null;
    
    const t = this.ctx.scene.findTokenById(id);
    if (t) return { type: 'token', id, radius: t.radius, offX: pointerX - t.x, offY: pointerY - t.y, startX: t.x, startY: t.y };
    
    const l = this.ctx.scene.findLightById(id);
    if (l) return { type: 'light', id, offX: pointerX - l.x, offY: pointerY - l.y, startX: l.x, startY: l.y };
    
    const m = this.ctx.scene.findImageById(id);
    if (m && !m.locked) return { type: 'image', id, offX: pointerX - m.x, offY: pointerY - m.y, startX: m.x, startY: m.y };
    
    const d = this.ctx.scene.findDoorById(id);
    if (d) return { type: 'door', id, offX: 0, offY: 0, startX: d.position, startY: 0 };
    
    const w = this.ctx.scene.findWindowById(id);
    if (w) return { type: 'window', id, offX: 0, offY: 0, startX: w.position, startY: 0 };
    
    return null;
  }
}
