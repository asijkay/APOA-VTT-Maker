import type { Point2 } from '../engine/CoordinateSystem';
import type { Camera } from '../engine/Camera';
import type { SceneStore } from '../scene/SceneStore';
import type { EditorPreviewRenderer } from '../renderer/EditorPreviewRenderer';
import type { EditorTool } from '../scene/SceneTypes';
import type { SelectionState } from './SelectionState';
import type { UndoManager } from '../scene/UndoManager';

export type ToolPointerEvent = {
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';
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
};

export type ToolContext = {
  camera: Camera;
  scene: SceneStore;
  undoManager: UndoManager;
  preview: EditorPreviewRenderer;
  selection: SelectionState;
  world: Readonly<{ screenToWorld: (sx: number, sy: number) => Point2 }>;
};

export interface EditorToolController {
  readonly id: EditorTool;
  attach(ctx: ToolContext): void;
  onPointer(e: ToolPointerEvent): void;
  onKey?(e: KeyboardEvent): void;
  deactivate(): void;
}
