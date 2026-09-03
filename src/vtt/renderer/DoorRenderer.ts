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
  private selectionId: string | null = null;
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

  setSelection(id: string | null): void {
    if (this.selectionId === id) return;
    this.selectionId = id;
    this.dirty = true;
  }

  markDirty(): void { this.dirty = true; }

  update(scene: Scene, camera: Camera, selectionId: string | null): void {
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

    if (!this.dirty && this.selectionId === selectionId) return;
    this.selectionId = selectionId;
    this.graphics.clear();

    const wallMap = new Map<string, Wall>();
    for (const wall of scene.walls) wallMap.set(wall.id, wall);

    for (const door of scene.doors) {
      const wall = wallMap.get(door.wallId);
      if (!wall) continue;
      this.drawDoor(door, wall, camera, selectionId === door.id, cs.zoom);
    }

    this.dirty = false;
  }

  private drawDoor(door: Door, wall: Wall, camera: Camera, isSelected: boolean, zoom: number): void {
    const isHorizontal = wall.y1 === wall.y2;

    // Door center in world → screen
    const cx = wall.x1 + (wall.x2 - wall.x1) * door.position;
    const cy = wall.y1 + (wall.y2 - wall.y1) * door.position;
    const sc = camera.worldToScreen(cx, cy);

    // Door endpoints in world → screen
    const halfW = door.width / 2;
    let sp1: { x: number; y: number };
    let sp2: { x: number; y: number };
    if (isHorizontal) {
      sp1 = camera.worldToScreen(cx - halfW, cy);
      sp2 = camera.worldToScreen(cx + halfW, cy);
    } else {
      sp1 = camera.worldToScreen(cx, cy - halfW);
      sp2 = camera.worldToScreen(cx, cy + halfW);
    }

    const doorLenPx = Math.sqrt(
      (sp2.x - sp1.x) ** 2 + (sp2.y - sp1.y) ** 2
    );
    // thickness of door panel in screen px (min 3, scales with zoom)
    const thickness = Math.max(3, 5 * zoom);

    if (door.state === 'closed') {
      this.drawClosedDoor(sp1, sp2, isHorizontal, thickness, door, isSelected);
    } else {
      this.drawOpenDoor(sp1, sp2, sc, cx, cy, wall, door, camera, doorLenPx, isHorizontal, thickness, isSelected);
    }

    if (door.locked) {
      this.drawLockIcon(sc.x, sc.y, Math.max(4, 6 * zoom));
    }

    void zoom;
  }

  private drawClosedDoor(
    sp1: { x: number; y: number },
    sp2: { x: number; y: number },
    isHorizontal: boolean,
    thickness: number,
    door: Door,
    isSelected: boolean,
  ): void {
    const g = this.graphics;
    const color = DoorRenderer.DOOR_CLOSED_COLOR;

    // Selection highlight (draw first, underneath)
    if (isSelected) {
      const pad = thickness + 2;
      g.setStrokeStyle({ width: 2, color: DoorRenderer.SELECT_COLOR, alpha: 1 });
      if (isHorizontal) {
        g.rect(sp1.x - 2, sp1.y - pad, sp2.x - sp1.x + 4, pad * 2);
      } else {
        g.rect(sp1.x - pad, sp1.y - 2, pad * 2, sp2.y - sp1.y + 4);
      }
      g.stroke();
    }

    // Door panel — filled rect
    g.setFillStyle({ color, alpha: DoorRenderer.HOVER_ALPHA });
    g.setStrokeStyle({ width: 1, color: 0x6b3d15, alpha: 1 });
    if (isHorizontal) {
      const h = thickness;
      g.rect(sp1.x, sp1.y - h / 2, sp2.x - sp1.x, h);
    } else {
      const w = thickness;
      g.rect(sp1.x - w / 2, sp1.y, w, sp2.y - sp1.y);
    }
    g.fill();
    g.stroke();

    // Door handle dots
    const mx = (sp1.x + sp2.x) / 2;
    const my = (sp1.y + sp2.y) / 2;
    g.setFillStyle({ color: 0x3d1f06, alpha: 1 });
    g.circle(mx, my, Math.max(2, thickness * 0.35));
    g.fill();

    void door;
  }

  private drawOpenDoor(
    sp1: { x: number; y: number },
    sp2: { x: number; y: number },
    sc: { x: number; y: number },
    _cx: number, _cy: number,
    wall: Wall,
    door: Door,
    camera: Camera,
    doorLenPx: number,
    isHorizontal: boolean,
    thickness: number,
    isSelected: boolean,
  ): void {
    const g = this.graphics;
    const color = DoorRenderer.DOOR_OPEN_COLOR;

    // Hinge is at sp1 (start of door opening), panel swings to sp2
    // Arc: quarter circle from the hinge point
    // The hinge is the wall-side corner, arc sweeps 90° inward

    // Determine hinge point and panel direction
    // For a horizontal wall: hinge at left endpoint (sp1), panel hangs down
    // For a vertical wall: hinge at top endpoint (sp1), panel hangs right
    const hingeX = sp1.x;
    const hingeY = sp1.y;
    const radius = doorLenPx;

    let startAngle: number;
    let endAngle: number;

    if (isHorizontal) {
      // Door panel: thin horizontal line (closed position) shown faded
      // Arc sweeps downward (or upward based on which side of wall we're on)
      const wallMidY = camera.worldToScreen(
        (wall.x1 + wall.x2) / 2, wall.y1
      ).y;
      const arcDir = sc.y >= wallMidY ? 1 : -1; // below or above
      startAngle = 0; // rightward (along wall)
      endAngle = arcDir * Math.PI / 2;
    } else {
      const wallMidX = camera.worldToScreen(
        wall.x1, (wall.y1 + wall.y2) / 2
      ).x;
      const arcDir = sc.x >= wallMidX ? 1 : -1;
      startAngle = -Math.PI / 2; // upward (along wall)
      endAngle = startAngle + arcDir * Math.PI / 2;
    }

    // Selection glow
    if (isSelected) {
      g.setStrokeStyle({ width: 3, color: DoorRenderer.SELECT_COLOR, alpha: 0.7 });
      g.arc(hingeX, hingeY, radius, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
      g.stroke();
    }

    // Arc (swing path)
    g.setStrokeStyle({ width: 1.5, color, alpha: 0.7 });
    g.beginPath();
    g.arc(hingeX, hingeY, radius, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
    g.stroke();

    // Door panel in open position (perpendicular line from hinge)
    const panelEndX = hingeX + Math.cos(endAngle) * radius;
    const panelEndY = hingeY + Math.sin(endAngle) * radius;
    g.setStrokeStyle({ width: thickness, color, alpha: DoorRenderer.HOVER_ALPHA });
    g.setFillStyle({ color, alpha: 0 });
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

    void door;
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