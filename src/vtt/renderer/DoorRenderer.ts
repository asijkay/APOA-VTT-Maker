import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../engine/Camera';
import type { Scene, Wall, Door } from '../scene/SceneTypes';

/**
 * DoorRenderer — screen-space rendering.
 * Converts world positions → screen positions each frame via camera.worldToScreen().
 * 
 * Closed door: filled rectangle panel along the wall (brown oak).
 * Open door:   architect-style arc (quarter circle sweep) + door panel line.
 * Locked:      small padlock circle at center when door.locked === true.
 * Selected:    bright teal outline around the door bounds.
 */
export class DoorRenderer {
  private container: Container;
  private graphics: Graphics;
  private selectionIds: ReadonlySet<string> = new Set();
  private dirty = true;

  private lastZoom = -1;
  private lastCamX = -Infinity;
  private lastCamY = -Infinity;

  // Colors
  private static readonly DOOR_CLOSED_COLOR = 0xa0693a;   // warm oak brown
  private static readonly DOOR_OPEN_COLOR   = 0xc8925a;   // lighter open-arc
  private static readonly LOCK_COLOR        = 0xffd166;   // amber lock
  private static readonly SELECT_COLOR      = 0x00e5ff;   // cyan selection
  private static readonly HOVER_ALPHA       = 0.85;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.name = 'doorLayer';
    parent.addChild(this.container);
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  getContainer(): Container { return this.container; }

  setSelection(ids: ReadonlySet<string>): void {
    if (this.selectionIds === ids) return;
    this.selectionIds = ids;
    this.dirty = true;
  }

  markDirty(): void { this.dirty = true; }

  update(scene: Scene, camera: Camera): void {
    const cs = camera.getState();
    const camChanged =
      cs.zoom !== this.lastZoom ||
      Math.abs(cs.x - this.lastCamX) > 0.05 ||
      Math.abs(cs.y - this.lastCamY) > 0.05;

    if (camChanged) {
      this.lastZoom = cs.zoom;
      this.lastCamX = cs.x;
      this.lastCamY = cs.y;
      this.dirty = true;
    }

    if (!this.dirty) return;
    this.graphics.clear();

    const wallMap = new Map<string, Wall>();
    for (const wall of scene.walls) wallMap.set(wall.id, wall);

    for (const door of scene.doors) {
      const wall = wallMap.get(door.wallId);
      if (!wall) continue;
      this.drawDoor(door, wall, camera, this.selectionIds.has(door.id), cs.zoom);
    }

    this.dirty = false;
  }

  private drawDoor(door: Door, wall: Wall, camera: Camera, isSelected: boolean, zoom: number): void {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    // Door center in world
    const cx = wall.x1 + dx * door.position;
    const cy = wall.y1 + dy * door.position;

    // Direction vector
    const dirX = dx / len;
    const dirY = dy / len;

    const halfW = door.width / 2;
    // Endpoints in world
    const wp1 = { x: cx - dirX * halfW, y: cy - dirY * halfW };
    const wp2 = { x: cx + dirX * halfW, y: cy + dirY * halfW };

    // To screen
    const sp1 = camera.worldToScreen(wp1.x, wp1.y);
    const sp2 = camera.worldToScreen(wp2.x, wp2.y);
    const sc = camera.worldToScreen(cx, cy);

    const doorLenPx = Math.sqrt((sp2.x - sp1.x) ** 2 + (sp2.y - sp1.y) ** 2);
    // thickness of door panel in screen px (min 3, scales with zoom)
    const thickness = Math.max(3, 5 * zoom);

    if (door.state === 'closed') {
      this.drawClosedDoor(sp1, sp2, thickness, door, isSelected);
    } else {
      this.drawOpenDoor(sp1, sp2, doorLenPx, thickness, isSelected, door.swingDirection ?? 1);
    }

    if (door.locked) {
      this.drawLockIcon(sc.x, sc.y, Math.max(4, 6 * zoom));
    }
  }

  private drawClosedDoor(
    sp1: { x: number; y: number },
    sp2: { x: number; y: number },
    thickness: number,
    _door: Door,
    isSelected: boolean,
  ): void {
    const g = this.graphics;
    const color = DoorRenderer.DOOR_CLOSED_COLOR;

    // Selection highlight (draw first, underneath)
    if (isSelected) {
      g.setStrokeStyle({ width: thickness + 4, color: DoorRenderer.SELECT_COLOR, alpha: 1, cap: 'butt' });
      g.beginPath();
      g.moveTo(sp1.x, sp1.y);
      g.lineTo(sp2.x, sp2.y);
      g.stroke();
    }

    // Door panel — filled line
    g.setStrokeStyle({ width: thickness, color, alpha: DoorRenderer.HOVER_ALPHA, cap: 'butt' });
    g.beginPath();
    g.moveTo(sp1.x, sp1.y);
    g.lineTo(sp2.x, sp2.y);
    g.stroke();

    // Door handle dots
    const mx = (sp1.x + sp2.x) / 2;
    const my = (sp1.y + sp2.y) / 2;
    g.setFillStyle({ color: 0x3d1f06, alpha: 1 });
    g.circle(mx, my, Math.max(2, thickness * 0.35));
    g.fill();
  }

  private drawOpenDoor(
    sp1: { x: number; y: number },
    sp2: { x: number; y: number },
    doorLenPx: number,
    thickness: number,
    isSelected: boolean,
    swingDirection: number,
  ): void {
    const g = this.graphics;
    const color = DoorRenderer.DOOR_OPEN_COLOR;

    // Hinge is at sp2 (end of door opening), panel swings to sp1
    const hingeX = sp2.x;
    const hingeY = sp2.y;
    const radius = doorLenPx;

    const angleAlongWall = Math.atan2(sp1.y - sp2.y, sp1.x - sp2.x);
    const arcDir = -1 * swingDirection; // Swing direction modifier
    const startAngle = angleAlongWall;
    const endAngle = angleAlongWall + arcDir * (Math.PI / 2);

    // Selection glow
    if (isSelected) {
      g.setStrokeStyle({ width: 3, color: DoorRenderer.SELECT_COLOR, alpha: 0.7 });
      g.beginPath();
      g.arc(hingeX, hingeY, radius, startAngle, endAngle, arcDir < 0);
      g.stroke();
    }

    // Arc (swing path)
    g.setStrokeStyle({ width: 1.5, color, alpha: 0.7 });
    g.beginPath();
    g.arc(hingeX, hingeY, radius, startAngle, endAngle, arcDir < 0);
    g.stroke();

    // Door panel in open position (perpendicular line from hinge)
    const panelEndX = hingeX + Math.cos(endAngle) * radius;
    const panelEndY = hingeY + Math.sin(endAngle) * radius;
    g.setStrokeStyle({ width: thickness, color, alpha: DoorRenderer.HOVER_ALPHA, cap: 'butt' });
    g.beginPath();
    g.moveTo(hingeX, hingeY);
    g.lineTo(panelEndX, panelEndY);
    g.stroke();

    // Thin line where wall continues (ghost of the closed door)
    g.setStrokeStyle({ width: 1, color, alpha: 0.25 });
    g.beginPath();
    g.moveTo(sp1.x, sp1.y);
    g.lineTo(sp2.x, sp2.y);
    g.stroke();
  }

  private drawLockIcon(cx: number, cy: number, r: number): void {
    const g = this.graphics;
    const color = DoorRenderer.LOCK_COLOR;
    // Shackle (top arc)
    g.setStrokeStyle({ width: Math.max(1, r * 0.35), color, alpha: 1 });
    g.beginPath();
    g.arc(cx, cy - r * 0.6, r * 0.5, Math.PI, 0);
    g.stroke();
    // Lock body (filled rect)
    g.setFillStyle({ color, alpha: 1 });
    g.rect(cx - r * 0.6, cy - r * 0.2, r * 1.2, r * 0.9);
    g.fill();
    // Keyhole
    g.setFillStyle({ color: 0x3d1f06, alpha: 1 });
    g.circle(cx, cy + r * 0.15, r * 0.2);
    g.fill();
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}