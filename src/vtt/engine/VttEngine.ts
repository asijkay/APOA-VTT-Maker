import { Application, Container } from 'pixi.js';
import { Camera } from './Camera';
import { GridRenderer } from '../renderer/GridRenderer';
import { FloorRenderer } from '../renderer/FloorRenderer';
import { WallRenderer } from '../renderer/WallRenderer';
import { DoorRenderer } from '../renderer/DoorRenderer';
import { LightRenderer } from '../renderer/LightRenderer';
import { TokenRenderer } from '../renderer/TokenRenderer';
import { VisionRenderer } from '../renderer/VisionRenderer';
import { WindowRenderer } from '../renderer/WindowRenderer';
import { FogRenderer } from '../renderer/FogRenderer';
import { EditorPreviewRenderer } from '../renderer/EditorPreviewRenderer';
import { SceneStore } from '../scene/SceneStore';
import { ZOOM_STEP } from './CoordinateSystem';
import { EditorController } from '../editor/EditorController';
import { computeAllVision } from '../systems/VisionSystem';
import { computeAllLighting } from '../systems/LightingSystem';
import { FogSystem } from '../systems/FogSystem';
import { PersistenceService } from '../scene/PersistenceService';
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
  onSelectionChange?: (id: string | null) => void;
  onSceneChange?: () => void;
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
  private wallRenderer: WallRenderer;
  private doorRenderer: DoorRenderer;
  private windowRenderer: WindowRenderer;
  private lightRenderer: LightRenderer;
  private tokenRenderer: TokenRenderer;
  private visionRenderer: VisionRenderer;
  private fogRenderer: FogRenderer;
  private previewRenderer: EditorPreviewRenderer;
  private editor: EditorController;
  private fogSystem: FogSystem;
  private viewMode: 'gm' | 'player' = 'gm';
  private autoSaveThrottle: ReturnType<typeof setTimeout> | null = null;
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
    this.worldLayer.zIndex = 1;
    this.worldLayer.sortableChildren = true;
    this.stageRoot.addChild(this.worldLayer);

    this.floorRenderer = new FloorRenderer(this.stageRoot);
    this.floorRenderer.getContainer().zIndex = 3;
    this.wallRenderer = new WallRenderer(this.stageRoot);
    this.wallRenderer.getContainer().zIndex = 5;
    this.windowRenderer = new WindowRenderer(this.stageRoot);
    this.windowRenderer.getContainer().zIndex = 55;
    this.doorRenderer = new DoorRenderer(this.stageRoot);
    this.doorRenderer.getContainer().zIndex = 6;
    this.lightRenderer = new LightRenderer(this.stageRoot);
    this.lightRenderer.getContainer().zIndex = 7;
    this.tokenRenderer = new TokenRenderer(this.stageRoot);
    this.tokenRenderer.getContainer().zIndex = 8;
    this.visionRenderer = new VisionRenderer(this.stageRoot);
    this.visionRenderer.getContainer().zIndex = 9;
    this.fogRenderer = new FogRenderer(this.stageRoot);
    this.fogRenderer.getContainer().zIndex = 85;
    this.previewRenderer = new EditorPreviewRenderer(this.stageRoot);
    this.previewRenderer.getContainer().zIndex = 10;
    this.previewRenderer.setCamera(this.camera);
    this.gridRenderer = new GridRenderer(this.stageRoot);
    this.fogSystem = new FogSystem();

    this.editor = new EditorController({
      camera: this.camera,
      scene: this.sceneStore,
      preview: this.previewRenderer,
      onActiveToolChange: options.onActiveToolChange,
      onSelectionChange: (id) => {
        this.wallRenderer.setSelection(id);
        this.doorRenderer.setSelection(id);
        this.windowRenderer.setSelection(id);
        this.lightRenderer.setSelection(id);
        this.tokenRenderer.setSelection(id);
        options.onSelectionChange?.(id);
      },
    });

    this.sceneUnsubscribe = this.sceneStore.subscribe(() => {
      this.floorRenderer.markDirty();
      this.wallRenderer.markDirty();
      this.doorRenderer.markDirty();
      this.windowRenderer.markDirty();
      this.lightRenderer.markDirty();
      this.tokenRenderer.markDirty();
      this.visionRenderer.markDirty();
      this.fogRenderer.markDirty();
      options.onSceneChange?.();
      this.scheduleAutoSave();
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
      roundPixels: true,
    });
    options.container.appendChild(app.canvas);
    const engine = new VttEngine(app, options);
    // Auto-load previously saved scene
    const saved = PersistenceService.loadFromLocalStorage();
    if (saved) engine.loadScene(saved);
    return engine;
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

  setDebugOptions(opts: { showVision?: boolean; showCollision?: boolean }): void {
    if (opts.showVision !== undefined) {
      this.visionRenderer.setDebugMode(opts.showVision);
    }
    if (opts.showCollision !== undefined) {
      this.wallRenderer.setDebugMode(opts.showCollision);
    }
    this.renderFrame();
  }

  /** Undo the last user action. Returns true if something was undone. */
  undo(): boolean {
    const result = this.editor.getUndoManager().undo();
    if (result) this.renderFrame();
    return result;
  }

  /** Redo the last undone action. Returns true if something was redone. */
  redo(): boolean {
    const result = this.editor.getUndoManager().redo();
    if (result) this.renderFrame();
    return result;
  }

  /**
   * GM / Player view mode.
   * In GM mode, fog of war is hidden.
   * In Player mode, fog of war is shown.
   */
  setViewMode(mode: 'gm' | 'player'): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.fogRenderer.setVisible(mode === 'player');
    this.renderFrame();
  }

  getViewMode(): 'gm' | 'player' {
    return this.viewMode;
  }

  /**
   * Replace the entire scene (e.g., after loading from file).
   * Clears the undo history.
   */
  loadScene(scene: import('../scene/SceneTypes').Scene): void {
    this.editor.getUndoManager().clear();
    this.fogSystem.reset();
    this.sceneStore.replace(scene);
  }

  /** Exports the current scene as a downloadable JSON file. */
  saveToFile(): void {
    PersistenceService.exportToFile(this.sceneStore.serialize());
  }

  /** Opens a file picker to import a scene from a JSON file. */
  async loadFromFile(): Promise<void> {
    const scene = await PersistenceService.importFromFile();
    if (scene) this.loadScene(scene);
  }

  /** Toggle token snap-to-grid. Default is true. */
  setSnapTokens(snap: boolean): void {
    this.editor.setSnapTokens(snap);
  }

  /** Clear the entire scene and start fresh. */
  newScene(): void {
    this.editor.getUndoManager().clear();
    this.fogSystem.reset();
    this.sceneStore.replace({
      floors: [], walls: [], doors: [], windows: [], lights: [], tokens: [],
    });
    PersistenceService.clearLocalStorage();
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
    const zoom = cs.zoom;
    const vpCx = Math.round(bounds.viewportWidth / 2);
    const vpCy = Math.round(bounds.viewportHeight / 2);

    const camX = Math.round(cs.x);
    const camY = Math.round(cs.y);

    const cssSubX = cssSubPixelSnap(camX, zoom);
    const cssSubY = cssSubPixelSnap(camY, zoom);

    this.worldLayer.position.set(vpCx + cssSubX, vpCy + cssSubY);
    this.worldLayer.scale.set(zoom, zoom);
    this.worldLayer.pivot.set(camX, camY);
  }

  private startTicker(): void {
    this.app.ticker.add(() => {
      this.renderFrame();
    });
  }

  private renderFrame(): void {
    this.gridRenderer.update(this.camera);
    const snapshot = this.sceneStore.snapshot();
    const selectionId = this.editor.getSelection();
    this.tokenRenderer.setSelection(selectionId);
    this.wallRenderer.setSelection(selectionId);
    this.doorRenderer.setSelection(selectionId);
    this.windowRenderer.setSelection(selectionId);
    
    // Compute vision polygons
    const visionResults = computeAllVision(snapshot);
    this.visionRenderer.setVisionResults(visionResults);
    
    // Update fog system
    this.fogSystem.update(visionResults);
    this.fogRenderer.updateCells(
      this.fogSystem.getRevealedCells(),
      this.fogSystem.getCurrentlyVisibleCells(),
    );
    
    // Compute lighting polygons
    const lightResults = computeAllLighting(snapshot);
    this.lightRenderer.setLightResults(lightResults);
    
    this.floorRenderer.update(snapshot, this.camera);
    this.wallRenderer.update(snapshot, this.camera, selectionId);
    this.windowRenderer.update(snapshot, this.camera, selectionId);
    this.doorRenderer.update(snapshot, this.camera, selectionId);
    this.lightRenderer.update(snapshot, this.camera, selectionId);
    this.tokenRenderer.update(snapshot, this.camera, selectionId);
    this.visionRenderer.update(this.camera);
    this.fogRenderer.update(this.camera);
  }

  private emitDebug(): void {
    if (!this.onDebugUpdate) return;
    this.onDebugUpdate(this.getDebugStats());
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveThrottle !== null) clearTimeout(this.autoSaveThrottle);
    this.autoSaveThrottle = setTimeout(() => {
      PersistenceService.saveToLocalStorage(this.sceneStore.serialize());
      this.autoSaveThrottle = null;
    }, 1000);
  }

  destroy(): void {
    if (this.autoSaveThrottle !== null) clearTimeout(this.autoSaveThrottle);
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
    this.fogRenderer.destroy();
    this.visionRenderer.destroy();
    this.lightRenderer.destroy();
    this.windowRenderer.destroy();
    this.doorRenderer.destroy();
    this.tokenRenderer.destroy();
    this.wallRenderer.destroy();
    this.floorRenderer.destroy();
    this.gridRenderer.destroy();

    this.app.destroy(true, { children: true, texture: true });
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
}

/**
 * Computes a CSS-px subpixel translation (< |0.5| px) to add to worldLayer position.
 * Ensures that grid-aligned world positions (multiples of GRID_SIZE) land on integer
 * CSS pixel edges after the zoom*translate composite transform, eliminating anti-aliased
 * "chopped top/left 1px edge" artifacts when zoom is not integer and pan is fractional
 * relative to device pixel grid.
 */
function cssSubPixelSnap(camWorld: number, zoom: number): number {
  const cssRaw = -camWorld * zoom;
  const cssRounded = Math.round(cssRaw);
  const frac = cssRaw - cssRounded;
  return -frac;
}
