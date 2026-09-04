import { Container, Sprite, Assets, Graphics } from 'pixi.js';
import type { Scene } from '../scene/SceneTypes';
import type { Camera } from '../engine/Camera';

export class ImageRenderer {
  private container: Container;
  private sprites = new Map<string, Sprite>();
  private selectionGlow = new Graphics();
  
  private lastZoom = -1;
  private lastCamX = -Infinity;
  private lastCamY = -Infinity;
  private selectionIds: ReadonlySet<string> = new Set();
  private dirty = true;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.name = 'imageLayer';
    parent.addChild(this.container);
    
    this.selectionGlow.zIndex = 100;
    this.container.addChild(this.selectionGlow);
    this.container.sortableChildren = true;
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
    
    // Sync sprites
    const currentIds = new Set(scene.images.map(img => img.id));
    for (const id of this.sprites.keys()) {
      if (!currentIds.has(id)) {
        const sprite = this.sprites.get(id);
        if (sprite) sprite.destroy();
        this.sprites.delete(id);
      }
    }

    this.selectionGlow.clear();

    for (const img of scene.images) {
      let sprite = this.sprites.get(img.id);
      if (!sprite) {
        sprite = new Sprite();
        sprite.anchor.set(0.5);
        this.sprites.set(img.id, sprite);
        this.container.addChild(sprite);
        this.loadImage(img.url, sprite);
      } else if (sprite.label !== img.url) {
        sprite.label = img.url;
        this.loadImage(img.url, sprite);
      }

      // Update transform
      const sp = camera.worldToScreen(img.x, img.y);
      sprite.x = sp.x;
      sprite.y = sp.y;
      sprite.width = img.width * cs.zoom;
      sprite.height = img.height * cs.zoom;
      sprite.alpha = img.opacity;
      
      if (this.selectionIds.has(img.id)) {
        this.selectionGlow.setStrokeStyle({ width: 3, color: 0x6aa9ff, alpha: 1 });
        this.selectionGlow.rect(
          sp.x - sprite.width / 2 - 2,
          sp.y - sprite.height / 2 - 2,
          sprite.width + 4,
          sprite.height + 4
        );
        this.selectionGlow.stroke();
      }
    }

    this.dirty = false;
  }

  private async loadImage(url: string, sprite: Sprite) {
    if (!url) {
       sprite.texture = undefined as any;
       return;
    }
    try {
      const texture = await Assets.load(url);
      if (!sprite.destroyed) {
        sprite.texture = texture;
      }
    } catch (e) {
      console.warn("Failed to load map image:", url);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
