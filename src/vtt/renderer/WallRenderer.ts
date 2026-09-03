import { Container, Graphics } from 'pixi.js';
import type { Scene, Wall } from '../scene/SceneTypes';
import type { Camera } from '../engine/Camera';
import { screenRect } from './FloorRenderer';
import { getEffectiveMovementSegments } from '../geometry/doorGeometry';

const WALL_THICKNESS = 4;
const SELECT_EXTRA = 2;

export class WallRenderer {
  private container: Container;
  private wallsContainer: Container;
  private graphics: Graphics;
  private selectionOverlay: Graphics;
  private lastWallCount = -1;
  private lastSelectionId: string | null = null;
  private lastZoom: number = -1;
  private lastCamX: number = -Infinity;
  private lastCamY: number = -Infinity;
  private dirty: boolean = true;
  private selectionDirty: boolean = true;

  private readonly wallColor = 0xd3d9e1;
  private readonly wallAlpha = 1.0;
  private readonly selectColor = 0x6aa9ff;
  private readonly selectAlpha = 1.0;
  private readonly endpointColor = 0xffffff;
  private readonly endpointAlpha = 1.0;
  private readonly endpointRadiusCssPx = 4;

  private debug = false;

  constructor(stage: Container) {
    this.container = new Container();
    this.container.name = 'walls';
    this.container.sortableChildren = true;
    this.wallsContainer = new Container();
    this.wallsContainer.name = 'walls.segments';
    this.wallsContainer.zIndex = 0;
    this.graphics = new Graphics();
    this.wallsContainer.addChild(this.graphics);
    this.selectionOverlay = new Graphics();
    this.selectionOverlay.zIndex = 1;
    this.container.addChild(this.wallsContainer, this.selectionOverlay);
    stage.addChild(this.container);
  }

  setDebugMode(debug: boolean): void {
    if (this.debug === debug) return;
    this.debug = debug;
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
    this.selectionDirty = true;
  }

  setSelection(selectionId: string | null): void {
    if (this.lastSelectionId === selectionId) return;
    this.lastSelectionId = selectionId;
    this.selectionDirty = true;
  }

  update(scene: Scene, camera: Camera, selectionId: string | null): void {
    const cs = camera.getState();
    const camChanged =
      cs.zoom !== this.lastZoom ||
      Math.abs(cs.x - this.lastCamX) > 0.03 ||
      Math.abs(cs.y - this.lastCamY) > 0.03;
    if (camChanged) {
      this.lastZoom = cs.zoom;
      this.lastCamX = cs.x;
      this.lastCamY = cs.y;
      this.dirty = true;
      this.selectionDirty = true;
    }
    if (this.dirty || scene.walls.length !== this.lastWallCount) {
      this.redrawAll(scene, camera);
      this.lastWallCount = scene.walls.length;
      this.dirty = false;
      this.selectionDirty = true;
    }
    if (this.lastSelectionId !== selectionId) {
      this.lastSelectionId = selectionId;
      this.selectionDirty = true;
    }
    if (this.selectionDirty) {
      this.redrawSelection(scene, camera);
      this.selectionDirty = false;
    }
  }

  private redrawAll(scene: Scene, camera: Camera): void {
    this.graphics.clear();
    for (const w of scene.walls) {
      this.drawWallRect(this.graphics, w, camera, this.wallColor, this.wallAlpha, WALL_THICKNESS);
    }
    
    if (this.debug) {
      for (const w of scene.walls) {
        if (!w.blocksMovement) continue;
        const segments = getEffectiveMovementSegments(w, scene.doors);
        for (const seg of segments) {
          const p1 = camera.worldToScreen(seg.p1.x, seg.p1.y);
          const p2 = camera.worldToScreen(seg.p2.x, seg.p2.y);
          this.graphics
            .moveTo(p1.x, p1.y)
            .lineTo(p2.x, p2.y)
            .stroke({ width: 2, color: 0xff0000, alpha: 0.8 });
        }
      }
    }
  }

  private redrawSelection(scene: Scene, camera: Camera): void {
    this.selectionOverlay.clear();
    if (!this.lastSelectionId) return;
    const w: Wall | undefined = scene.walls.find((x) => x.id === this.lastSelectionId);
    if (!w) return;

    this.drawWallRect(
      this.selectionOverlay,
      w,
      camera,
      this.selectColor,
      this.selectAlpha,
      WALL_THICKNESS + SELECT_EXTRA * 2,
    );

    const drawEndpoint = (wx: number, wy: number) => {
      const sp = camera.worldToScreen(wx, wy);
      this.selectionOverlay
        .circle(sp.x, sp.y, this.endpointRadiusCssPx)
        .fill({ color: this.endpointColor, alpha: this.endpointAlpha })
        .stroke({ width: 1, color: this.selectColor, alpha: this.selectAlpha });
    };
    drawEndpoint(w.x1, w.y1);
    drawEndpoint(w.x2, w.y2);
  }

  private drawWallRect(
    g: Graphics,
    w: Wall,
    camera: Camera,
    color: number,
    alpha: number,
    thickness: number,
  ): void {
    const isHorizontal = w.y1 === w.y2;
    const isVertical = w.x1 === w.x2;
    if (!isHorizontal && !isVertical) return;
    const h = thickness;
    let rx1: number;
    let ry1: number;
    let rx2: number;
    let ry2: number;
    if (isHorizontal) {
      rx1 = w.x1;
      ry1 = w.y1 - h / 2;
      rx2 = w.x2;
      ry2 = w.y1 + h / 2;
    } else {
      rx1 = w.x1 - h / 2;
      ry1 = w.y1;
      rx2 = w.x1 + h / 2;
      ry2 = w.y2;
    }
    const r = screenRect(camera, rx1, ry1, rx2, ry2);
    g.rect(r.sx, r.sy, r.sw, r.sh).fill({ color, alpha });
  }

  getContainer(): Container {
    return this.container;
  }

  destroy(): void {
    this.selectionOverlay.destroy();
    this.graphics.destroy();
    this.wallsContainer.destroy();
    this.container.destroy();
  }
}
