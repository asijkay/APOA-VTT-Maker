# editor

## Overview
Editor input layer. `EditorController` owns the tool registry, selection, undo manager, camera panning, and keyboard shortcuts, and forwards canvas pointer events to the active tool. Tools live in [./tools/EGM.md](./tools/EGM.md).

## Interface
- `EditorTool.ts`: types `ToolPointerEvent`, `ToolContext`; interface `EditorToolController {id, attach, onPointer, onKey?, deactivate}`.
- `SelectionState.ts`: type `SelectionListener`; class `SelectionState` (`get`, `has`, `set`, `setSingle`, `add`, `remove`, `toggle`, `clear`, `subscribe`).
- `EditorController.ts`: type `EditorControllerOpts`; class `EditorController` (`setActiveTool`, `getActiveTool`, `getRegisteredToolIds`, `setViewMode`, `setLocalPeerId`, `setSnapTokens`, `onCanvasPointerDown/Move/Up/Cancel`, `getPanningActive`, `getSelection`, `getUndoManager`, `deleteSelection`, `destroy`).
- Subdirectory: [tools](./tools/EGM.md) - concrete tool implementations.

## Invariants
- [EditorController.ts] Registered tools are `select`, `floor`, `erase-floor`, `wall`, `door`, `light`, `token`, `image`, `window`, `ruler` (from imports and `EditorTool` union).
- [SelectionState.ts] Listeners are notified on selection changes.
- [EditorController.ts:deleteSelection] Batch removals use `opBatch` with `opRemove*` so deletion is a single undo step.

## Side Effects
- [EditorController.ts] Registers keydown/keyup handlers (removed in `destroy`); mutates the scene via `UndoManager`; invokes `onActiveToolChange`, `onSelectionChange`, `onEphemeralEvent` callbacks.

## Verification
- Run: `npm test`
