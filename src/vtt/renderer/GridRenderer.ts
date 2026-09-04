import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../engine/Camera';

export class GridRenderer {
  public container: Container;
  private minorLines: Graphics;
  private majorLines: Graphics;
  private axisLines: Graphics;

  private readonly minorColor = 0x2a303a;
  private readonly minorAlpha = 1.0;
  private readonly majorColor = 0x4a5568;
  private readonly majorAlpha = 1.0;
  private readonly axisColor = 0x7a5cff;
  private readonly axisAlpha = 0.9;

  constructor(stage: Container) {
    this.container = new Container();
    this.container.name = 'grid';
    this.container.visible = true;
    this.container.renderable = true;
    this.container.eventMode = 'none';
    this.container.sortableChildren = true;
    this.container.zIndex = 1000;

    this.minorLines = new Graphics();
    this.majorLines = new Graphics();
    this.axisLines = new Graphics();
    for (const g of [this.minorLines, this.majorLines, this.axisLines]) {
      g.visible = true;
      g.renderable = true;
      g.eventMode = 'none';
    }
    this.minorLines.zIndex = 1;
    this.majorLines.zIndex = 2;
    this.axisLines.zIndex = 3;

    this.container.addChild(this.minorLines, this.majorLines, this.axisLines);
    stage.addChild(this.container);
  }

  update(camera: Camera, mapWidth: number, mapHeight: number, gridSize: number): void {
    const bounds = camera.getBounds();
    this.minorLines.clear();
    this.majorLines.clear();
    this.axisLines.clear();

    const worldLeft = Math.max(0, bounds.worldLeft);
    const worldRight = Math.min(mapWidth * gridSize, bounds.worldRight);
    const worldTop = Math.max(0, bounds.worldTop);
    const worldBottom = Math.min(mapHeight * gridSize, bounds.worldBottom);

    const startGX = Math.max(0, Math.floor(worldLeft / gridSize));
    const endGX = Math.min(mapWidth, Math.ceil(worldRight / gridSize));
    const startGY = Math.max(0, Math.floor(worldTop / gridSize));
    const endGY = Math.min(mapHeight, Math.ceil(worldBottom / gridSize));

    const halfPx = (n: number) => Math.round(n) + 0.5;

    const minorPts: Array<[number, number, number, number]> = [];
    const majorPts: Array<[number, number, number, number]> = [];

    // Map boundary points
    const mapTopY = camera.worldToScreen(0, 0).y;
    const mapBottomY = camera.worldToScreen(0, mapHeight * gridSize).y;
    const mapLeftX = camera.worldToScreen(0, 0).x;
    const mapRightX = camera.worldToScreen(mapWidth * gridSize, 0).x;

    for (let gx = startGX; gx <= endGX; gx++) {
      const x = gx * gridSize;
      const p1 = camera.worldToScreen(x, 0);
      const sx = halfPx(p1.x);
      const y0 = halfPx(mapTopY);
      const y1 = halfPx(mapBottomY);
      
      // Ensure we don't draw lines completely off-screen, though startGX/endGX handles this mostly
      if (gx % 5 === 0 || gx === 0 || gx === mapWidth) majorPts.push([sx, y0, sx, y1]);
      else minorPts.push([sx, y0, sx, y1]);
    }
    
    for (let gy = startGY; gy <= endGY; gy++) {
      const y = gy * gridSize;
      const p1 = camera.worldToScreen(0, y);
      const sy = halfPx(p1.y);
      const x0 = halfPx(mapLeftX);
      const x1 = halfPx(mapRightX);
      
      if (gy % 5 === 0 || gy === 0 || gy === mapHeight) majorPts.push([x0, sy, x1, sy]);
      else minorPts.push([x0, sy, x1, sy]);
    }

    const strokeSegs = (
      g: Graphics,
      segs: Array<[number, number, number, number]>,
      color: number,
      alpha: number,
      width: number
    ) => {
      if (segs.length === 0) return;
      for (const [x1, y1, x2, y2] of segs) {
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
      }
      g.stroke({ width, color, alpha });
    };

    strokeSegs(this.minorLines, minorPts, this.minorColor, this.minorAlpha, 1);
    strokeSegs(this.majorLines, majorPts, this.majorColor, this.majorAlpha, 1);

    const axisSegs: Array<[number, number, number, number]> = [];
    if (worldTop <= 0 && worldBottom >= 0) {
      const a = camera.worldToScreen(worldLeft, 0);
      const b = camera.worldToScreen(worldRight, 0);
      const sy = halfPx(a.y);
      axisSegs.push([halfPx(a.x), sy, halfPx(b.x), sy]);
    }
    if (worldLeft <= 0 && worldRight >= 0) {
      const a = camera.worldToScreen(0, worldTop);
      const b = camera.worldToScreen(0, worldBottom);
      const sx = halfPx(a.x);
      axisSegs.push([sx, halfPx(a.y), sx, halfPx(b.y)]);
    }
    strokeSegs(this.axisLines, axisSegs, this.axisColor, this.axisAlpha, 2);
  }

  destroy(): void {
    this.minorLines.destroy();
    this.majorLines.destroy();
    this.axisLines.destroy();
    this.container.destroy();
  }
}
