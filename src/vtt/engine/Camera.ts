import type { Point2 } from './CoordinateSystem';
import { MAX_ZOOM, MIN_ZOOM } from './CoordinateSystem';

export type CameraState = {
  x: number;
  y: number;
  zoom: number;
};

export type ViewportBounds = {
  worldLeft: number;
  worldTop: number;
  worldRight: number;
  worldBottom: number;
  viewportWidth: number;
  viewportHeight: number;
};

export class Camera {
  private state: CameraState = { x: 0, y: 0, zoom: 1 };
  private viewportWidth: number = 1;
  private viewportHeight: number = 1;

  constructor() {}

  setViewportSize(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
  }

  getState(): Readonly<CameraState> {
    return this.state;
  }

  setPosition(x: number, y: number): void {
    this.state.x = x;
    this.state.y = y;
  }

  translate(dx: number, dy: number): void {
    this.state.x += dx;
    this.state.y += dy;
  }

  setZoom(zoom: number): void {
    this.state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.state.zoom * factor));
    if (newZoom === this.state.zoom) return;
    this.state.zoom = newZoom;
    const worldAfter = this.screenToWorld(screenX, screenY);
    this.state.x += worldBefore.x - worldAfter.x;
    this.state.y += worldBefore.y - worldAfter.y;
  }

  screenToWorld(screenX: number, screenY: number): Point2 {
    return {
      x: this.state.x + (screenX - this.viewportWidth / 2) / this.state.zoom,
      y: this.state.y + (screenY - this.viewportHeight / 2) / this.state.zoom,
    };
  }

  worldToScreen(worldX: number, worldY: number): Point2 {
    return {
      x: (worldX - this.state.x) * this.state.zoom + this.viewportWidth / 2,
      y: (worldY - this.state.y) * this.state.zoom + this.viewportHeight / 2,
    };
  }

  getBounds(): ViewportBounds {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(this.viewportWidth, this.viewportHeight);
    return {
      worldLeft: topLeft.x,
      worldTop: topLeft.y,
      worldRight: bottomRight.x,
      worldBottom: bottomRight.y,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
    };
  }
}
