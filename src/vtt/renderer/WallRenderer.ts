import { Container, Graphics } from 'pixi.js';
import type { Scene, Wall } from '../scene/SceneTypes';
import type { Camera } from '../engine/Camera';
import { getEffectiveMovementSegments } from '../geometry/doorGeometry';

const WALL_THICKNESS = 4;
const SELECT_EXTRA = 2;

export class WallRenderer {
  private container: Container;
  private wallsContainer: Container;
  private graphics: Graphics;
  private selectionOverlay: Graphics;
  private lastWallCount = -1;
  private lastSelectionIds: ReadonlySet<string> = new Set();
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

  setSelection(selectionIds: ReadonlySet<string>, force: boolean = false): void {
    if (
      this.lastSelectionIds === selectionIds &&
      !force
    ) {
      return;
    }
    this.lastSelectionIds = selectionIds;
    this.selectionDirty = true;
  }

  update(scene: Scene, camera: Camera): void {
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
    for (const w of scene.walls) {
      const isSelected = this.lastSelectionIds.has(w.id);
      if (isSelected) {
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
    }
  }

  private drawWallRect(
    g: Graphics,
    w: Wall,
    camera: Camera,
    color: number,
    alpha: number,
    thickness: number,
  ): void {
    const sp1 = camera.worldToScreen(w.x1, w.y1);
    const sp2 = camera.worldToScreen(w.x2, w.y2);
    
    g.setStrokeStyle({ width: thickness, color, alpha, cap: 'butt' });
    g.beginPath();
    g.moveTo(sp1.x, sp1.y);
    g.lineTo(sp2.x, sp2.y);
    g.stroke();
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
