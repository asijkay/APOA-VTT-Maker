import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Camera } from '../engine/Camera';
import type { LightResult } from '../systems/LightingSystem';
import type { Scene } from '../scene/SceneTypes';

/**
 * One shared soft radial gradient (white in the middle, fading to nothing at the edge).
 * Every light is this texture, tinted with the light's colour and scaled to its radius,
 * so a light glows brightest at its source and fades with distance.
 */
let sharedGlow: Texture | null = null;
function glowTexture(): Texture {
  if (sharedGlow) return sharedGlow;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.32)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  sharedGlow = Texture.from(canvas);
  return sharedGlow;
}

type LightSprite = { sprite: Sprite; mask: Graphics };

export class LightRenderer {
  private container: Container;
  /** Selection rings only. */
  private graphics: Graphics;
  private glowLayer: Container;
  private glows = new Map<string, LightSprite>();
  private lightResults: LightResult[] = [];
  private selectionIds: ReadonlySet<string> = new Set();
  private dirty = true;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.label = 'lightLayer';
    parent.addChild(this.container);

    this.glowLayer = new Container();
    this.container.addChild(this.glowLayer);

    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  getContainer(): Container {
    return this.container;
  }

  setSelection(ids: ReadonlySet<string>): void {
    if (this.selectionIds === ids) return;
    this.selectionIds = ids;
    this.dirty = true;
  }

  setLightResults(results: LightResult[]): void {
    this.lightResults = results;
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  private lastZoom = -1;
  private lastCamX = -Infinity;
  private lastCamY = -Infinity;

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

    const lightsById = new Map(scene.lights.map((l) => [l.id, l]));
    const live = new Set<string>();

    for (const result of this.lightResults) {
      const light = lightsById.get(result.lightId);
      if (!light || result.polygon.length < 3) continue;
      live.add(result.lightId);

      let glow = this.glows.get(result.lightId);
      if (!glow) {
        const mask = new Graphics();
        const sprite = new Sprite(glowTexture());
        sprite.anchor.set(0.5);
        sprite.blendMode = 'add';
        sprite.mask = mask;
        // The mask must live in the display tree for the stencil to apply.
        this.glowLayer.addChild(mask);
        this.glowLayer.addChild(sprite);
        glow = { sprite, mask };
        this.glows.set(result.lightId, glow);
      }

      // Walls and closed doors cut the light: the glow is clipped to the visibility polygon.
      glow.mask.clear();
      const p0 = camera.worldToScreen(result.polygon[0].x, result.polygon[0].y);
      glow.mask.moveTo(p0.x, p0.y);
      for (let i = 1; i < result.polygon.length; i++) {
        const p = camera.worldToScreen(result.polygon[i].x, result.polygon[i].y);
        glow.mask.lineTo(p.x, p.y);
      }
      glow.mask.closePath();
      glow.mask.fill({ color: 0xffffff });

      const centre = camera.worldToScreen(light.x, light.y);
      const diameter = result.radius * 2 * cs.zoom;
      glow.sprite.x = centre.x;
      glow.sprite.y = centre.y;
      glow.sprite.width = diameter;
      glow.sprite.height = diameter;
      glow.sprite.tint = this.parseColor(result.color);
      glow.sprite.alpha = 0.55;

      if (this.selectionIds.has(result.lightId)) {
        this.graphics.setStrokeStyle({ width: 2, color: 0x2dd4bf }); // selection highlight
        this.graphics.beginPath();
        this.graphics.arc(centre.x, centre.y, 15, 0, Math.PI * 2);
        this.graphics.stroke();
      }
    }

    // Drop the glow of any light that was deleted or switched off.
    for (const [id, glow] of this.glows) {
      if (!live.has(id)) {
        glow.sprite.destroy();
        glow.mask.destroy();
        this.glows.delete(id);
      }
    }

    this.dirty = false;
  }

  private parseColor(colorStr: string): number {
    if (colorStr.startsWith('#')) {
      const v = parseInt(colorStr.slice(1), 16);
      return Number.isFinite(v) ? v : 0xffffff;
    }
    return 0xffffff;
  }

  destroy(): void {
    for (const glow of this.glows.values()) { glow.sprite.destroy(); glow.mask.destroy(); }
    this.glows.clear();
    this.graphics.destroy();
    this.container.destroy();
  }
}
