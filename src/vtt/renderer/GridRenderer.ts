import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../engine/Camera';
import { GRID_SIZE } from '../engine/CoordinateSystem';

export class GridRenderer {
  private container: Container;
  private lines: Graphics;
  private axisLines: Graphics;

  private readonly minorColor = 0x262b33;
  private readonly minorAlpha = 0.9;
  private readonly majorColor = 0x353c48;
  private readonly majorAlpha = 1.0;
  private readonly axisColor = 0x7a5cff;
  private readonly axisAlpha = 0.7;

  constructor(stage: Container) {
    this.container = new Container();
    this.container.name = 'grid';
    this.lines = new Graphics();
    this.axisLines = new Graphics();
    this.container.addChild(this.lines, this.axisLines);
    stage.addChild(this.container);
  }

  update(camera: Camera): void {
    const bounds = camera.getBounds();
    this.lines.clear();
    this.axisLines.clear();

    const worldLeft = bounds.worldLeft;
    const worldRight = bounds.worldRight;
    const worldTop = bounds.worldTop;
    const worldBottom = bounds.worldBottom;

    const minorStep = GRID_SIZE;
    const majorStep = GRID_SIZE * 5;

    const startGX = Math.floor(worldLeft / minorStep) - 1;
    const endGX = Math.ceil(worldRight / minorStep) + 1;
    const startGY = Math.floor(worldTop / minorStep) - 1;
    const endGY = Math.ceil(worldBottom / minorStep) + 1;

    this.lines.moveTo(worldLeft, worldTop);

    for (let gx = startGX; gx <= endGX; gx++) {
      const x = gx * minorStep;
      const isMajor = gx % 5 === 0;
      this.lines
        .moveTo(x, worldTop)
        .lineTo(x, worldBottom)
        .stroke({
          width: 1 / camera.getState().zoom,
          color: isMajor ? this.majorColor : this.minorColor,
          alpha: isMajor ? this.majorAlpha : this.minorAlpha,
        });
    }

    for (let gy = startGY; gy <= endGY; gy++) {
      const y = gy * minorStep;
      const isMajor = gy % 5 === 0;
      this.lines
        .moveTo(worldLeft, y)
        .lineTo(worldRight, y)
        .stroke({
          width: 1 / camera.getState().zoom,
          color: isMajor ? this.majorColor : this.minorColor,
          alpha: isMajor ? this.majorAlpha : this.minorAlpha,
        });
    }

    const camState = camera.getState();
    const axisWidth = Math.max(1 / camState.zoom, 1);

    if (worldTop <= 0 && worldBottom >= 0) {
      this.axisLines
        .moveTo(worldLeft, 0)
        .lineTo(worldRight, 0)
        .stroke({ width: axisWidth, color: this.axisColor, alpha: this.axisAlpha });
    }
    if (worldLeft <= 0 && worldRight >= 0) {
      this.axisLines
        .moveTo(0, worldTop)
        .lineTo(0, worldBottom)
        .stroke({ width: axisWidth, color: this.axisColor, alpha: this.axisAlpha });
    }
    void majorStep;
  }

  destroy(): void {
    this.lines.destroy();
    this.axisLines.destroy();
    this.container.destroy();
  }
}
