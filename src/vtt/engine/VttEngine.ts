import { Application, Container } from 'pixi.js';
import { Camera } from './Camera';
import { GridRenderer } from '../renderer/GridRenderer';
import { ZOOM_STEP } from './CoordinateSystem';

export type DebugStats = {
  cameraX: number;
  cameraY: number;
  zoom: number;
  mouseWorldX: number;
  mouseWorldY: number;
};

type EngineOptions = {
  canvas: HTMLCanvasElement;
  onDebugUpdate?: (stats: DebugStats) => void;
};

export class VttEngine {
  private app: Application;
  private camera: Camera;
  private stageRoot: Container;
  private worldLayer: Container;
  private gridRenderer: GridRenderer;

  private isPanning: boolean = false;
  private lastPointer: { x: number; y: number } | null = null;
  private mouseWorld: { x: number; y: number } = { x: 0, y: 0 };

  private resizeObserver?: ResizeObserver;
  private onDebugUpdate?: (stats: DebugStats) => void;

  private handleWheelBound: (e: WheelEvent) => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerUpBound: (e: PointerEvent) => void;
  private handlePointerLeaveBound: (e: PointerEvent) => void;

  private constructor(app: Application, options: EngineOptions) {
    this.app = app;
    this.onDebugUpdate = options.onDebugUpdate;
    this.camera = new Camera();

    this.stageRoot = new Container();
    this.stageRoot.name = 'stageRoot';
    this.app.stage.addChild(this.stageRoot);

    this.worldLayer = new Container();
    this.worldLayer.name = 'worldLayer';
    this.stageRoot.addChild(this.worldLayer);

    this.gridRenderer = new GridRenderer(this.worldLayer);

    this.handleWheelBound = (e) => this.handleWheel(e);
    this.handlePointerDownBound = (e) => this.handlePointerDown(e);
    this.handlePointerMoveBound = (e) => this.handlePointerMove(e);
    this.handlePointerUpBound = (e) => this.handlePointerUp(e);
    this.handlePointerLeaveBound = (e) => this.handlePointerLeave(e);

    this.attachInput(options.canvas);
    this.updateViewportSize(options.canvas);
    this.startTicker();
  }

  static async create(options: EngineOptions): Promise<VttEngine> {
    const app = new Application();
    await app.init({
      canvas: options.canvas,
      background: 0x0b0d10,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    return new VttEngine(app, options);
  }

  getCamera(): Camera {
    return this.camera;
  }

  getDebugStats(): DebugStats {
    const cs = this.camera.getState();
    return {
      cameraX: cs.x,
      cameraY: cs.y,
      zoom: cs.zoom,
      mouseWorldX: this.mouseWorld.x,
      mouseWorldY: this.mouseWorld.y,
    };
  }

  setPanningCursor(active: boolean): void {
    const canvas = this.app.canvas as HTMLCanvasElement;
    if (active) canvas.classList.add('panning');
    else canvas.classList.remove('panning');
  }

  private attachInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('wheel', this.handleWheelBound, { passive: false });
    canvas.addEventListener('pointerdown', this.handlePointerDownBound);
    window.addEventListener('pointermove', this.handlePointerMoveBound);
    window.addEventListener('pointerup', this.handlePointerUpBound);
    window.addEventListener('pointercancel', this.handlePointerUpBound);
    canvas.addEventListener('pointerleave', this.handlePointerLeaveBound);

    this.resizeObserver = new ResizeObserver(() => {
      this.updateViewportSize(canvas);
    });
    this.resizeObserver.observe(canvas);
  }

  private updateViewportSize(canvas: HTMLCanvasElement): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);

    this.app.renderer.resize(cssWidth * dpr, cssHeight * dpr);
    this.app.canvas.style.width = `${cssWidth}px`;
    this.app.canvas.style.height = `${cssHeight}px`;
    this.camera.setViewportSize(cssWidth, cssHeight);
    this.applyWorldTransform();
    this.renderFrame();
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const canvas = this.app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    this.camera.zoomAt(sx, sy, factor);
    this.applyWorldTransform();
    this.renderFrame();
    this.emitDebug();
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    this.isPanning = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.setPanningCursor(true);
    (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
  }

  private handlePointerMove(e: PointerEvent): void {
    const canvas = this.app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    this.mouseWorld = this.camera.screenToWorld(sx, sy);

    if (this.isPanning && this.lastPointer) {
      const dx = (this.lastPointer.x - e.clientX) / this.camera.getState().zoom;
      const dy = (this.lastPointer.y - e.clientY) / this.camera.getState().zoom;
      this.camera.translate(dx, dy);
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.applyWorldTransform();
      this.renderFrame();
    }

    this.emitDebug();
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isPanning) return;
    this.isPanning = false;
    this.lastPointer = null;
    this.setPanningCursor(false);
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.releasePointerCapture?.(e.pointerId);
  }

  private handlePointerLeave(_e: PointerEvent): void {
    if (this.isPanning) return;
  }

  private applyWorldTransform(): void {
    const cs = this.camera.getState();
    const bounds = this.camera.getBounds();
    const pivotX = bounds.viewportWidth / 2;
    const pivotY = bounds.viewportHeight / 2;

    this.worldLayer.position.set(pivotX, pivotY);
    this.worldLayer.scale.set(cs.zoom, cs.zoom);
    this.worldLayer.pivot.set(cs.x, cs.y);
  }

  private startTicker(): void {
    this.app.ticker.add(() => {
      this.renderFrame();
    });
  }

  private renderFrame(): void {
    this.gridRenderer.update(this.camera);
  }

  private emitDebug(): void {
    if (!this.onDebugUpdate) return;
    this.onDebugUpdate(this.getDebugStats());
  }

  destroy(): void {
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.removeEventListener('wheel', this.handleWheelBound);
    canvas.removeEventListener('pointerdown', this.handlePointerDownBound);
    window.removeEventListener('pointermove', this.handlePointerMoveBound);
    window.removeEventListener('pointerup', this.handlePointerUpBound);
    window.removeEventListener('pointercancel', this.handlePointerUpBound);
    canvas.removeEventListener('pointerleave', this.handlePointerLeaveBound);
    this.resizeObserver?.disconnect();

    this.gridRenderer.destroy();
    this.app.destroy(true, { children: true, texture: true });
  }
}
