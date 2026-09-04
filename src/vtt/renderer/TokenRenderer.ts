import { Container, Graphics, Text, Assets, Sprite } from 'pixi.js';
import type { Scene, Token } from '../scene/SceneTypes';
import type { Camera } from '../engine/Camera';

/**
 * TokenRenderer — renders tokens as colored circles with optional portrait images.
 * Token names appear as text labels below each token.
 * Image assets are loaded asynchronously and cached by URL.
 */
export class TokenRenderer {
  private container: Container;
  private graphics: Graphics;
  private labelContainer: Container;
  private spriteContainer: Container;

  /** Text label objects keyed by token id */
  private labels = new Map<string, Text>();
  /** Sprite + mask pairs keyed by token id */
  private sprites = new Map<string, { sprite: Sprite; mask: Graphics }>();
  /** URLs currently being loaded */
  private textureLoading = new Set<string>();

  private lastCount = -1;
  private lastZoom = -1;
  private lastCamX: number = -Infinity;
  private lastCamY: number = -Infinity;
  private selectionIds: ReadonlySet<string> = new Set();
  private dirty = true;

  private readonly fillColor = 0xf2a36b;
  private readonly fillAlpha = 0.97;
  private readonly outlineColor = 0xffffff;
  private readonly selectColor = 0x6aa9ff;
  private readonly radiusBleedCssPx = 1;

  constructor(stage: Container) {
    this.container = new Container();
    this.container.name = 'tokens';
    stage.addChild(this.container);

    this.graphics = new Graphics();
    this.container.addChild(this.graphics);

    this.spriteContainer = new Container();
    this.container.addChild(this.spriteContainer);

    this.labelContainer = new Container();
    this.container.addChild(this.labelContainer);
  }

  markDirty(): void { this.dirty = true; }

  setSelection(ids: ReadonlySet<string>): void {
    if (this.selectionIds === ids) return;
    this.selectionIds = ids;
    this.dirty = true;
  }

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

    if (this.dirty || scene.tokens.length !== this.lastCount) {
      this.redrawAll(scene, camera);
      this.lastCount = scene.tokens.length;
      this.dirty = false;
    }
  }

  private redrawAll(scene: Scene, camera: Camera): void {
    this.graphics.clear();
    const zoom = Math.max(0.01, this.lastZoom);

    // Track active ids to clean up removed tokens
    const activeIds = new Set(scene.tokens.map(t => t.id));

    for (const [id, label] of this.labels) {
      if (!activeIds.has(id)) { label.destroy(); this.labels.delete(id); }
    }
    for (const [id, pair] of this.sprites) {
      if (!activeIds.has(id)) {
        pair.sprite.destroy();
        pair.mask.destroy();
        this.sprites.delete(id);
      }
    }

    for (const t of scene.tokens) {
      const sp = camera.worldToScreen(t.x, t.y);
      const rCss = Math.max(1, t.radius * zoom) + this.radiusBleedCssPx;
      const rInt = Math.ceil(rCss);
      const cx = Math.round(sp.x);
      const cy = Math.round(sp.y);
      const isSelected = this.selectionIds.has(t.id);

      if (!t.imageUrl) {
        // Plain colored circle
        this.graphics
          .circle(cx, cy, rInt)
          .fill({ color: this.fillColor, alpha: this.fillAlpha })
          .stroke({ width: 1, color: this.outlineColor, alpha: 1, alignment: 0 });

        // Hide any stale sprite for this token
        const stale = this.sprites.get(t.id);
        if (stale) { stale.sprite.visible = false; stale.mask.visible = false; }
      } else {
        // Outline ring as the circle background
        this.graphics
          .circle(cx, cy, rInt)
          .fill({ color: 0x1a1a2e, alpha: 0.6 })
          .stroke({ width: 2, color: this.outlineColor, alpha: 0.9, alignment: 0 });

        this.loadOrUpdateSprite(t, cx, cy, rInt);
      }

      if (isSelected) {
        this.graphics
          .circle(cx, cy, rInt + 3)
          .stroke({ width: 2, color: this.selectColor, alpha: 1, alignment: 1 });
      }

      this.updateLabel(t, cx, cy, rInt, zoom);
    }
  }

  private loadOrUpdateSprite(token: Token, cx: number, cy: number, radius: number): void {
    const url = token.imageUrl!;

    const existing = this.sprites.get(token.id);
    if (existing) {
      existing.sprite.visible = true;
      existing.sprite.x = cx - radius;
      existing.sprite.y = cy - radius;
      existing.sprite.width = radius * 2;
      existing.sprite.height = radius * 2;
      // Update circular mask
      existing.mask.clear();
      existing.mask.circle(cx, cy, radius).fill({ color: 0xffffff });
      existing.mask.visible = true;
      return;
    }

    if (this.textureLoading.has(url)) return;
    this.textureLoading.add(url);

    Assets.load(url).then((texture) => {
      if (!texture) return;

      const sprite = new Sprite(texture);
      sprite.x = cx - radius;
      sprite.y = cy - radius;
      sprite.width = radius * 2;
      sprite.height = radius * 2;

      // Circular mask using Graphics
      const maskGfx = new Graphics();
      maskGfx.circle(cx, cy, radius).fill({ color: 0xffffff });
      sprite.mask = maskGfx;

      this.spriteContainer.addChild(maskGfx);
      this.spriteContainer.addChild(sprite);
      this.sprites.set(token.id, { sprite, mask: maskGfx });
      this.dirty = true;
    }).catch(() => {
      this.textureLoading.delete(url);
    });
  }

  private updateLabel(token: Token, cx: number, cy: number, radius: number, zoom: number): void {
    const name = token.name ?? '';
    if (!name) {
      const existing2 = this.labels.get(token.id);
    if (existing2) existing2.visible = false;
      return;
    }

    let label = this.labels.get(token.id);
    if (!label) {
      label = new Text({
        text: name,
        style: {
          fontSize: 11,
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 2 },
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 'bold',
        },
      });
      label.anchor.set(0.5, 0);
      this.labelContainer.addChild(label);
      this.labels.set(token.id, label);
    }

    label.text = name;
    label.x = cx;
    label.y = cy + radius + Math.max(3, 4 * zoom);
    label.scale.set(Math.max(0.5, Math.min(1.5, zoom)));
    label.visible = true;
  }

  getContainer(): Container { return this.container; }

  destroy(): void {
    for (const label of this.labels.values()) label.destroy();
    for (const pair of this.sprites.values()) { pair.sprite.destroy(); pair.mask.destroy(); }
    this.labels.clear();
    this.sprites.clear();
    this.graphics.destroy();
    this.container.destroy();
  }
}
