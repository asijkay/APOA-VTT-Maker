import type { Camera } from '../engine/Camera';
import type { Point2 } from '../engine/CoordinateSystem';
import type { EditorTool } from '../scene/SceneTypes';
import type { SceneStore } from '../scene/SceneStore';
import type { EditorPreviewRenderer } from '../renderer/EditorPreviewRenderer';
import type { EditorToolController, ToolContext, ToolPointerEvent } from './EditorTool';
import { EraseFloorTool, FloorTool } from './tools/PaintTools';
import { SelectTool } from './tools/SelectTool';
import { WallTool } from './tools/WallTool';
import { DoorTool } from './tools/DoorTool';
import { LightTool } from './tools/LightTool';
import { TokenTool } from './tools/TokenTool';
import { ImageTool } from './tools/ImageTool';
import { WindowTool } from './tools/WindowTool';
import { RulerTool } from './tools/RulerTool';
import { SelectionState, type SelectionListener } from './SelectionState';
import { UndoManager, opBatch, opRemoveWall, opRemoveToken, opRemoveDoor, opRemoveLight, opRemoveWindow, opRemoveImage } from '../scene/UndoManager';

export type EditorControllerOpts = {
  camera: Camera;
  scene: SceneStore;
  preview: EditorPreviewRenderer;
  onActiveToolChange?: (tool: EditorTool) => void;
  onSelectionChange?: SelectionListener;
};

type PanState =
  | { active: false }
  | { active: true; lastX: number; lastY: number; mode: 'space' | 'right' | 'middle' };

export class EditorController {
  private camera: Camera;
  private scene: SceneStore;
  private preview: EditorPreviewRenderer;
  private selection: SelectionState;
  private undoManager: UndoManager;
  private tools: Map<EditorTool, EditorToolController>;
  private activeToolId: EditorTool = 'select';
  private activeTool: EditorToolController;
  private ctx: ToolContext;
  private pan: PanState = { active: false };
  private spacePressed = false;
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;
  private onActiveToolChange?: (tool: EditorTool) => void;
  private activePointerId: number | null = null;
  private _snapTokens = true;
  private _viewMode: 'gm' | 'player' = 'gm';

  constructor(opts: EditorControllerOpts) {
    this.camera = opts.camera;
    this.scene = opts.scene;
    this.preview = opts.preview;
    this.selection = new SelectionState();
    this.undoManager = new UndoManager(opts.scene);
    this.onActiveToolChange = opts.onActiveToolChange;
    if (opts.onSelectionChange) {
      this.selection.subscribe(opts.onSelectionChange);
    }

    this.tools = new Map();
    this.registerTool(new SelectTool());
    this.registerTool(new FloorTool());
    this.registerTool(new EraseFloorTool());
    this.registerTool(new WallTool());
    this.registerTool(new DoorTool());
    this.registerTool(new WindowTool());
    this.registerTool(new LightTool());
    this.registerTool(new TokenTool());
    this.registerTool(new ImageTool());
    this.registerTool(new RulerTool());

    this.activeTool = this.tools.get(this.activeToolId)!;
    const selectionRef = this.selection;
    this.ctx = {
      camera: this.camera,
      scene: this.scene,
      undoManager: this.undoManager,
      preview: this.preview,
      selection: this.selection,
      snapTokens: this._snapTokens,
      viewMode: this._viewMode,
      world: {
        screenToWorld: (sx, sy) => this.camera.screenToWorld(sx, sy),
      },
    };
    void selectionRef;

    this.activeTool.attach(this.ctx);

    this.handleKeyDownBound = (e) => this.handleKeyDown(e);
    this.handleKeyUpBound = (e) => this.handleKeyUp(e);
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
  }

  private registerTool(tool: EditorToolController): void {
    this.tools.set(tool.id, tool);
  }

  getActiveTool(): EditorTool {
    return this.activeToolId;
  }

  getRegisteredToolIds(): EditorTool[] {
    return Array.from(this.tools.keys());
  }

  setActiveTool(id: EditorTool): void {
    if (id === this.activeToolId) return;
    const tool = this.tools.get(id);
    if (!tool) return;
    this.activeTool.deactivate();
    this.activeToolId = id;
    this.activeTool = tool;
    this.activeTool.attach(this.ctx);
    this.onActiveToolChange?.(id);
  }

  setViewMode(mode: 'gm' | 'player'): void {
    this._viewMode = mode;
    this.ctx.viewMode = mode;
    if (mode === 'player') {
      this.setActiveTool('select');
    }
  }

  onCanvasPointerDown(e: {
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
    button: number;
    buttons: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    pointerId: number;
    preventDefault: () => void;
  }): void {
    this.activePointerId = e.pointerId;
    const shouldPan = this.shouldPanForButton(e.button, e.shiftKey || e.ctrlKey || e.metaKey || e.altKey);
    if (shouldPan) {
      this.startPan(
        this.panModeForButton(e.button, this.spacePressed),
        e.screenX,
        e.screenY,
      );
      return;
    }
    if (e.button !== 0) return;
    const ev = this.buildEvent('pointerdown', e);
    this.activeTool.onPointer(ev);
  }

  onCanvasPointerMove(e: {
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
    button: number;
    buttons: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    pointerId: number;
  }): void {
    if (this.pan.active && this.activePointerId === e.pointerId) {
      this.continuePan(e.screenX, e.screenY);
      return;
    }
    const ev = this.buildEvent('pointermove', e);
    this.activeTool.onPointer(ev);
  }

  onCanvasPointerUp(e: {
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
    button: number;
    buttons: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    pointerId: number;
  }): void {
    if (this.pan.active) {
      this.endPan();
      if (this.activePointerId === e.pointerId) this.activePointerId = null;
      return;
    }
    const ev = this.buildEvent('pointerup', e);
    this.activeTool.onPointer(ev);
    if (this.activePointerId === e.pointerId) this.activePointerId = null;
  }

  onCanvasPointerCancel(e: {
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
    button: number;
    buttons: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    pointerId: number;
  }): void {
    if (this.pan.active) this.endPan();
    const ev = this.buildEvent('pointercancel', e);
    this.activeTool.onPointer(ev);
    if (this.activePointerId === e.pointerId) this.activePointerId = null;
  }

  getPanningActive(): boolean {
    return this.pan.active || this.spacePressed;
  }

  getSelection(): ReadonlySet<string> {
    return this.selection.get();
  }

  getUndoManager(): UndoManager {
    return this.undoManager;
  }

  setSnapTokens(snap: boolean): void {
    this._snapTokens = snap;
    this.ctx.snapTokens = snap;
  }

  private buildEvent(
    type: ToolPointerEvent['type'],
    e: {
      screenX: number;
      screenY: number;
      worldX: number;
      worldY: number;
      button: number;
      buttons: number;
      shiftKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      altKey: boolean;
      pointerId: number;
    },
  ): ToolPointerEvent {
    return {
      type,
      screenX: e.screenX,
      screenY: e.screenY,
      worldX: e.worldX,
      worldY: e.worldY,
      button: e.button,
      buttons: e.buttons,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      pointerId: e.pointerId,
    };
  }

  private shouldPanForButton(button: number, hasPanModifier: boolean): boolean {
    if (button === 1 || button === 2) return true;
    if (button === 0 && (this.spacePressed || hasPanModifier)) return true;
    return false;
  }

  private panModeForButton(
    button: number,
    spaceActive: boolean,
  ): PanState extends { active: true } ? PanState['mode'] : 'space' | 'right' | 'middle' {
    if (spaceActive && button === 0) return 'space';
    if (button === 2) return 'right';
    if (button === 1) return 'middle';
    return 'space';
  }

  private startPan(mode: 'space' | 'right' | 'middle', sx: number, sy: number): void {
    this.activeTool.onPointer({
      type: 'pointercancel',
      screenX: sx,
      screenY: sy,
      worldX: this.camera.screenToWorld(sx, sy).x,
      worldY: this.camera.screenToWorld(sx, sy).y,
      button: 0,
      buttons: 0,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      pointerId: -1,
    });
    this.pan = { active: true, lastX: sx, lastY: sy, mode };
  }

  private continuePan(sx: number, sy: number): void {
    if (!this.pan.active) return;
    const zoom = this.camera.getState().zoom;
    const dx = (this.pan.lastX - sx) / zoom;
    const dy = (this.pan.lastY - sy) / zoom;
    this.camera.translate(dx, dy);
    this.pan.lastX = sx;
    this.pan.lastY = sy;
  }

  private endPan(): void {
    this.pan = { active: false };
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (e.code === 'Space') {
      this.spacePressed = true;
      e.preventDefault();
      return;
    }
    if (e.target instanceof HTMLElement) {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this._viewMode === 'player') return;
      
      const selectedIds = this.selection.get();
      if (selectedIds.size > 0) {
        const ops = [];
        for (const sel of selectedIds) {
          const wall = this.scene.findWallById(sel);
          if (wall) {
            const { id, ...data } = wall;
            ops.push(opRemoveWall(sel, data));
            continue;
          }
          const token = this.scene.findTokenById(sel);
          if (token) {
            const { id, ...data } = token;
            ops.push(opRemoveToken(sel, data));
            continue;
          }
          const door = this.scene.findDoorById(sel);
          if (door) {
            const { id, ...data } = door;
            ops.push(opRemoveDoor(sel, data));
            continue;
          }
          const light = this.scene.findLightById(sel);
          if (light) {
            const { id, ...data } = light;
            ops.push(opRemoveLight(sel, data));
            continue;
          }
          const win = this.scene.findWindowById(sel);
          if (win) {
            const { id, ...data } = win;
            ops.push(opRemoveWindow(sel, data));
            continue;
          }
          const img = this.scene.findImageById(sel);
          if (img && !img.locked) {
            const { id, ...data } = img;
            ops.push(opRemoveImage(sel, data));
            continue;
          }
        }
        
        if (ops.length > 0) {
          this.undoManager.execute(ops.length === 1 ? ops[0] : opBatch('Delete Objects', ops));
          this.selection.clear();
          e.preventDefault();
        }
        return;
      }
    }
    if (this._viewMode === 'player') return; // no tool hotkeys in player mode

    switch (e.key.toLowerCase()) {
      case 'v':
        this.setActiveTool('select');
        break;
      case 'f':
        this.setActiveTool('floor');
        break;
      case 'e':
        this.setActiveTool('erase-floor');
        break;
      case 'm':
        this.setActiveTool('image');
        break;
      case 'r':
        this.setActiveTool('ruler');
        break;
      case 'w':
        this.setActiveTool('wall');
        break;
      case 'd':
        this.setActiveTool('door');
        break;
      case 'i':
        this.setActiveTool('window');
        break;
      case 'l':
        this.setActiveTool('light');
        break;
      case 't':
        this.setActiveTool('token');
        break;
      case 'escape':
        this.selection.set(null);
        break;
      default:
        break;
    }
    if (this.activeTool.onKey) this.activeTool.onKey(e);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') this.spacePressed = false;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    for (const t of this.tools.values()) t.deactivate();
  }

  public _noopPoint(_p: Point2): void {
    // reserved for future geometry helpers
  }
}
