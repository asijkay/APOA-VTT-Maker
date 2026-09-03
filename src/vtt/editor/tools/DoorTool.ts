import type { EditorToolController, ToolContext, ToolPointerEvent } from '../EditorTool';
import { DoorSystem } from '../../systems/DoorSystem';
import type { EditorTool } from '../../scene/SceneTypes';

export class DoorTool implements EditorToolController {
  id: EditorTool = 'door';
  private ctx: ToolContext | null = null;
  private isDragging = false;
  private selectedDoorId: string | null = null;
  private dragStartWorld: { x: number; y: number } | null = null;

  attach(ctx: ToolContext): void {
    this.ctx = ctx;
  }

  deactivate(): void {
    this.ctx = null;
    this.isDragging = false;
    this.selectedDoorId = null;
    this.dragStartWorld = null;
  }

  onPointer(e: ToolPointerEvent): void {
    if (!this.ctx) return;

    const { scene, selection } = this.ctx;

    switch (e.type) {
      case 'pointerdown':
        if (e.button === 0) {
          // Check if clicking on existing door
          const door = this.findDoorAt(e.worldX, e.worldY);
          if (door) {
            // Select the door
            this.selectedDoorId = door.id;
            selection.set(door.id);
            this.isDragging = true;
            this.dragStartWorld = { x: e.worldX, y: e.worldY };
          } else {
            // Try to place new door
            const snapshot = scene.snapshot();
            const newDoor = DoorSystem.placeDoor(snapshot, e.worldX, e.worldY);
            if (newDoor) {
              const result = scene.addDoor(newDoor);
              if (result) {
                this.selectedDoorId = result.id;
                selection.set(result.id);
              }
            }
          }
        }
        break;

      case 'pointermove':
        if (this.isDragging && this.selectedDoorId && this.dragStartWorld) {
          // Handle door dragging along wall
          const door = scene.findDoorById(this.selectedDoorId);
          if (door) {
            const snapshot = scene.snapshot();
            const wall = snapshot.walls.find(w => w.id === door.wallId);
            if (wall) {
              // Project current position onto wall
              const projection = this.projectPointOnWall(e.worldX, e.worldY, wall);
              if (projection) {
                // Move door to new position
                DoorSystem.moveDoor(door, projection.position);
              }
            }
          }
        }
        break;

      case 'pointerup':
        this.isDragging = false;
        this.dragStartWorld = null;
        break;

      case 'pointercancel':
        this.isDragging = false;
        this.dragStartWorld = null;
        break;
    }
  }

  onKey(e: KeyboardEvent): void {
    if (!this.ctx || !this.selectedDoorId) return;

    const { scene } = this.ctx;
    const door = scene.findDoorById(this.selectedDoorId);
    if (!door) return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        scene.removeDoor(this.selectedDoorId);
        this.selectedDoorId = null;
        this.ctx.selection.set(null);
        e.preventDefault();
        break;
      case ' ':
      case 'Enter':
        // Toggle door state
        DoorSystem.toggleDoor(door);
        e.preventDefault();
        break;
    }
  }

  private findDoorAt(x: number, y: number) {
    if (!this.ctx) return null;
    const { scene } = this.ctx;
    const snapshot = scene.snapshot();
    
    for (const door of snapshot.doors) {
      const wall = snapshot.walls.find(w => w.id === door.wallId);
      if (!wall) continue;

      const doorX = wall.x1 + (wall.x2 - wall.x1) * door.position;
      const doorY = wall.y1 + (wall.y2 - wall.y1) * door.position;

      const dx = x - doorX;
      const dy = y - doorY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < door.width / 2 + 5) {
        return door;
      }
    }
    return null;
  }

  private projectPointOnWall(x: number, y: number, wall: any) {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return null;

    let t = ((x - wall.x1) * dx + (y - wall.y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    return { position: t };
  }
}