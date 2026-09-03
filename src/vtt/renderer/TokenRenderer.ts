import { Container, Graphics } from 'pixi.js';
import type { Scene } from '../scene/SceneTypes';
import type { Camera } from '../engine/Camera';

export class TokenRenderer {
  private container: Container;
  private graphics: Graphics;
  private lastCount = -1;
  private lastZoom = -1;
  private lastCamX: number = -Infinity;
  private lastCamY: number = -Infinity;
  private lastSelectionId: string | null = null;
  private dirty = true;

  private readonly fillColor = 0xf2a36b;
  private readonly fillAlpha = 0.97;
  private readonly outlineColor = 0xffffff;
  private readonly outlineWidthCssPx = 1;
  private readonly selectColor = 0x6aa9ff;
  private readonly selectWidthCssPx = 2;
  private readonly radiusBleedCssPx = 1;

  constructor(stage: Container) {
    this.container = new Container();
    this.container.name = 'tokens';
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    stage.addChild(this.container);
  }

  markDirty(): void {
    this.dirty = true;
  }

  setSelection(selectionId: string | null): void {
    if (this.lastSelectionId === selectionId) return;
    this.lastSelectionId = selectionId;
    this.dirty = true;
  }

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
    if (this.lastSelectionId !== selectionId) {
      this.lastSelectionId = selectionId;
      this.dirty = true;
    }
    if (this.dirty || scene.tokens.length !== this.lastCount) {
      this.redrawAll(scene, camera);
      this.lastCount = scene.tokens.length;
      this.dirty = false;
    }
  }

  private redrawAll(scene: Scene, camera: Camera): void {
    this.graphics.clear();
    const zoom = Math.max(0.01, this.lastZoom);
    for (const t of scene.tokens) {
      const sp = camera.worldToScreen(t.x, t.y);
      const rCss = Math.max(1, t.radius * zoom) + this.radiusBleedCssPx;
      const rInt = Math.ceil(rCss);
      const cx = Math.round(sp.x);
      const cy = Math.round(sp.y);
      const isSelected = this.lastSelectionId === t.id;

      this.graphics
        .circle(cx, cy, rInt)
        .fill({ color: this.fillColor, alpha: this.fillAlpha })
        .stroke({
          width: this.outlineWidthCssPx,
          color: this.outlineColor,
          alpha: 1,
          alignment: 0,
        });

      if (isSelected) {
        this.graphics
          .circle(cx, cy, rInt + this.selectWidthCssPx)
          .stroke({
            width: this.selectWidthCssPx,
            color: this.selectColor,
            alpha: 1,
            alignment: 1,
          });
      }
    }
    void zoom;
  }

  getContainer(): Container {
    return this.container;
  }

  destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}
