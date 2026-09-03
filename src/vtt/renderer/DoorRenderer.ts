import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../engine/Camera';
import type { Scene, Wall } from '../scene/SceneTypes';

export class DoorRenderer {
  private container: Container;
  private graphics: Graphics;
  private selectionId: string | null = null;
  private dirty = true;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.name = 'doorLayer';
    parent.addChild(this.container);

    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  getContainer(): Container {
    return this.container;
  }

  setSelection(id: string | null): void {
    this.selectionId = id;
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  update(scene: Scene, _camera: Camera, selectionId: string | null): void {
    if (!this.dirty && this.selectionId === selectionId) return;
    
    this.selectionId = selectionId;
    this.graphics.clear();

    // Create a map of walls for position calculation
    const wallMap = new Map<string, Wall>();
    for (const wall of scene.walls) {
      wallMap.set(wall.id, wall);
    }

    for (const door of scene.doors) {
      const wall = wallMap.get(door.wallId);
      if (!wall) continue;

      // Calculate door position in world coordinates
      const doorX = wall.x1 + (wall.x2 - wall.x1) * door.position;
      const doorY = wall.y1 + (wall.y2 - wall.y1) * door.position;

      // Draw door based on state
      if (door.state === 'closed') {
        // Closed door: draw as a line segment
        this.graphics.setStrokeStyle({ width: 4, color: 0x8B4513 }); // Brown
        this.graphics.beginPath();
        
        // Calculate door endpoints perpendicular to wall
        const isHorizontal = wall.y1 === wall.y2;
        if (isHorizontal) {
          const halfWidth = door.width / 2;
          this.graphics.moveTo(doorX - halfWidth, doorY);
          this.graphics.lineTo(doorX + halfWidth, doorY);
        } else {
          const halfWidth = door.width / 2;
          this.graphics.moveTo(doorX, doorY - halfWidth);
          this.graphics.lineTo(doorX, doorY + halfWidth);
        }
        
        this.graphics.stroke();
      } else {
        // Open door: draw as an arc
        this.graphics.setStrokeStyle({ width: 2, color: 0x8B4513 });
        this.graphics.beginPath();
        
        const isHorizontal = wall.y1 === wall.y2;
        const doorRadius = door.width;
        
        if (isHorizontal) {
          // Draw arc for horizontal wall
          this.graphics.arc(doorX, doorY, doorRadius, 0, Math.PI / 2);
        } else {
          // Draw arc for vertical wall
          this.graphics.arc(doorX, doorY, doorRadius, -Math.PI / 2, 0);
        }
        
        this.graphics.stroke();
      }

      // Draw selection highlight
      if (door.id === selectionId) {
        this.graphics.setStrokeStyle({ width: 2, color: 0x00FF00 }); // Green highlight
        this.graphics.beginPath();
        
        const isHorizontal = wall.y1 === wall.y2;
        if (isHorizontal) {
          const halfWidth = door.width / 2 + 4;
          this.graphics.moveTo(doorX - halfWidth, doorY - 4);
          this.graphics.lineTo(doorX + halfWidth, doorY - 4);
          this.graphics.lineTo(doorX + halfWidth, doorY + 4);
          this.graphics.lineTo(doorX - halfWidth, doorY + 4);
          this.graphics.closePath();
        } else {
          const halfWidth = door.width / 2 + 4;
          this.graphics.moveTo(doorX - 4, doorY - halfWidth);
          this.graphics.lineTo(doorX + 4, doorY - halfWidth);
          this.graphics.lineTo(doorX + 4, doorY + halfWidth);
          this.graphics.lineTo(doorX - 4, doorY + halfWidth);
          this.graphics.closePath();
        }
        
        this.graphics.stroke();
      }
    }

    this.dirty = false;
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}