import { Application, Container } from 'pixi.js';
import { Camera } from './Camera';
import { GridRenderer } from '../renderer/GridRenderer';
import { FloorRenderer } from '../renderer/FloorRenderer';
import { EditorPreviewRenderer } from '../renderer/EditorPreviewRenderer';
import { SceneStore } from '../scene/SceneStore';
import { ZOOM_STEP } from './CoordinateSystem';
import { EditorController } from '../editor/EditorController';
import type { EditorTool } from '../scene/SceneTypes';

export type DebugStats = {
  cameraX: number;
  cameraY: number;
  zoom: number;
  mouseWorldX: number;
  mouseWorldY: number;
};

type EngineOptions = {
  container: HTMLElement;
  onDebugUpdate?: (stats: DebugStats) => void;
  onActiveToolChange?: (tool: EditorTool) => void;
};

export class VttEngine {
  private app: Application;
  private container: HTMLElement;
  private camera: Camera;
  private sceneStore: SceneStore;
  private stageRoot: Container;
  private worldLayer: Container;
  private gridRenderer: GridRenderer;
  private floorRenderer: FloorRenderer;
  private previewRenderer: EditorPreviewRenderer;
  private editor: EditorController;

  private mouseWorld: { x: number; y: number } = { x: 0, y: 0 };

  private onDebugUpdate?: (stats: DebugStats) => void;

  private handleWheelBound: (e: WheelEvent) => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerUpBound: (e: PointerEvent) => void;
  private handlePointerLeaveBound: (e: PointerEvent) => void;
  private handleContextMenuBound: (e: Event) => void;
  private handleResizeBound: () => void;
  private sceneUnsubscribe?: () => void;

  private constructor(app: Application, options: EngineOptions) {
    this.app = app;
    this.container = options.container;
    this.onDebugUpdate = options.onDebugUpdate;
    this.camera = new Camera();
    this.sceneStore = new SceneStore();

    this.stageRoot = new Container();
    this.stageRoot.name = 'stageRoot';
    this.stageRoot.sortableChildren = true;
    this.app.stage.addChild(this.stageRoot);

    this.worldLayer = new Container();
    this.worldLayer.name = 'worldLayer';
    this.worldLayer.zIndex = 0;
    this.stageRoot.addChild(this.worldLayer);

    this.floorRenderer = new FloorRenderer(this.worldLayer);
    this.previewRenderer = new EditorPreviewRenderer(this.worldLayer);
    this.gridRenderer = new GridRenderer(this.stageRoot);

    this.editor = new EditorController({
      camera: this.camera,
      scene: this.sceneStore,
      preview: this.previewRenderer,
      onActiveToolChange: options.onActiveToolChange,
    });

    this.sceneUnsubscribe = this.sceneStore.subscribe(() => {
      this.floorRenderer.markDirty();
    });

    this.handleWheelBound = (e) => this.handleWheel(e);
    this.handlePointerDownBound = (e) => this.handlePointerDown(e);
    this.handlePointerMoveBound = (e) => this.handlePointerMove(e);
    this.handlePointerUpBound = (e) => this.handlePointerUp(e);
    this.handlePointerLeaveBound = (e) => this.handlePointerLeave(e);
    this.handleContextMenuBound = (e) => this.handleContextMenu(e);
    this.handleResizeBound = () => this.updateViewportSize();

    this.attachInput();
    this.updateViewportSize();
    this.app.renderer.on('resize', this.handleResizeBound);
    this.startTicker();
  }

  static async create(options: EngineOptions): Promise<VttEngine> {
    const app = new Application();
    await app.init({
      resizeTo: options.container,
      background: 0x0b0d10,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    options.container.appendChild(app.canvas);
    return new VttEngine(app, options);
  }

  getCamera(): Camera {
    return this.camera;
  }

  getScene(): SceneStore {
    return this.sceneStore;
  }

  getActiveTool(): EditorTool {
    return this.editor.getActiveTool();
  }

  setActiveTool(id: EditorTool): void {
    this.editor.setActiveTool(id);
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

  private getCanvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  private attachInput(): void {
    const canvas = this.getCanvas();
    canvas.addEventListener('contextmenu', this.handleContextMenuBound);
    canvas.addEventListener('wheel', this.handleWheelBound, { passive: false });
    canvas.addEventListener('pointerdown', this.handlePointerDownBound);
    window.addEventListener('pointermove', this.handlePointerMoveBound);
    window.addEventListener('pointerup', this.handlePointerUpBound);
    window.addEventListener('pointercancel', this.handlePointerUpBound);
    canvas.addEventListener('pointerleave', this.handlePointerLeaveBound);
  }

  private updateViewportSize(): void {
    const rect = this.container.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    this.camera.setViewportSize(cssWidth, cssHeight);
    this.applyWorldTransform();
    this.renderFrame();
  }

  private handleContextMenu(e: Event): void {
    e.preventDefault();
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const canvas = this.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    this.camera.zoomAt(sx, sy, factor);
    this.applyWorldTransform();
    this.renderFrame();
    this.emitDebug();
  }

  private pointerViewport(e: PointerEvent): { sx: number; sy: number } {
    const canvas = this.getCanvas();
    const rect = canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
    const { sx, sy } = this.pointerViewport(e);
    const world = this.camera.screenToWorld(sx, sy);
    this.mouseWorld = world;
    this.editor.onCanvasPointerDown({
      screenX: sx,
      screenY: sy,
      worldX: world.x,
      worldY: world.y,
      button: e.button,
      buttons: e.buttons,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      pointerId: e.pointerId,
      preventDefault: () => e.preventDefault(),
    });
    this.applyWorldTransform();
    this.renderFrame();
    this.emitDebug();
    this.updateCursorClass();
  }

  private handlePointerMove(e: PointerEvent): void {
    const { sx, sy } = this.pointerViewport(e);
    const world = this.camera.screenToWorld(sx, sy);
    this.mouseWorld = world;
    this.editor.onCanvasPointerMove({
      screenX: sx,
      screenY: sy,
      worldX: world.x,
      worldY: world.y,
      button: e.button,
      buttons: e.buttons,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      pointerId: e.pointerId,
    });
    this.applyWorldTransform();
    this.renderFrame();
    this.emitDebug();
    this.updateCursorClass();
  }

  private handlePointerUp(e: PointerEvent): void {
    const { sx, sy } = this.pointerViewport(e);
    const world = this.camera.screenToWorld(sx, sy);
    this.mouseWorld = world;
    if (e.type === 'pointercancel') {
      this.editor.onCanvasPointerCancel({
        screenX: sx,
        screenY: sy,
        worldX: world.x,
        worldY: world.y,
        button: e.button,
        buttons: e.buttons,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        pointerId: e.pointerId,
      });
    } else {
      this.editor.onCanvasPointerUp({
        screenX: sx,
        screenY: sy,
        worldX: world.x,
        worldY: world.y,
        button: e.button,
        buttons: e.buttons,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        pointerId: e.pointerId,
      });
    }
    const canvas = this.getCanvas();
    canvas.releasePointerCapture?.(e.pointerId);
    this.applyWorldTransform();
    this.renderFrame();
    this.emitDebug();
    this.updateCursorClass();
  }

  private handlePointerLeave(_e: PointerEvent): void {
    this.updateCursorClass();
  }

  private updateCursorClass(): void {
    const canvas = this.getCanvas();
    const panning = this.editor.getPanningActive();
    if (panning) canvas.classList.add('panning');
    else canvas.classList.remove('panning');
  }

  private applyWorldTransform(): void {
    const cs = this.camera.getState();
    const bounds = this.camera.getBounds();
    const pivotX = Math.round(bounds.viewportWidth / 2);
    const pivotY = Math.round(bounds.viewportHeight / 2);

    this.worldLayer.position.set(pivotX, pivotY);
    this.worldLayer.scale.set(cs.zoom, cs.zoom);
    this.worldLayer.pivot.set(Math.round(cs.x), Math.round(cs.y));
  }

  private startTicker(): void {
    this.app.ticker.add(() => {
      this.renderFrame();
    });
  }

  private renderFrame(): void {
    this.gridRenderer.update(this.camera);
    this.floorRenderer.update(this.sceneStore.snapshot(), this.camera);
  }

  private emitDebug(): void {
    if (!this.onDebugUpdate) return;
    this.onDebugUpdate(this.getDebugStats());
  }

  destroy(): void {
    this.app.renderer.off('resize', this.handleResizeBound);

    const canvas = this.getCanvas();
    canvas.removeEventListener('contextmenu', this.handleContextMenuBound);
    canvas.removeEventListener('wheel', this.handleWheelBound);
    canvas.removeEventListener('pointerdown', this.handlePointerDownBound);
    window.removeEventListener('pointermove', this.handlePointerMoveBound);
    window.removeEventListener('pointerup', this.handlePointerUpBound);
    window.removeEventListener('pointercancel', this.handlePointerUpBound);
    canvas.removeEventListener('pointerleave', this.handlePointerLeaveBound);

    this.sceneUnsubscribe?.();

    this.editor.destroy();
    this.previewRenderer.destroy();
    this.floorRenderer.destroy();
    this.gridRenderer.destroy();

    this.app.destroy(true, { children: true, texture: true });
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
}
