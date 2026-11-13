# editor/tools

## Overview
One class per editor tool, each implementing `EditorToolController` (from `../EditorTool.ts`). `EditorController` registers them and routes pointer events to the active tool.

## Interface
- `SelectTool` (selection, box select, drag), `WallTool` (exports `snapToGridIntersection`, `snapWallEndpoints`), `DoorTool`, `WindowTool`, `LightTool`, `TokenTool`, `ImageTool`, `RulerTool`: each `implements EditorToolController` with `id`, `attach(ctx)`, `onPointer(e)`, `deactivate()` and optional `onKey`.
- `PaintTools.ts`: `FloorTool`, `EraseFloorTool` (share a floor-family base), `screenCell`, `rasterizeLineCells`, `cellCenter`.

## Invariants
- [All tools] Obtain scene, camera, undo manager, preview, and selection only from the `ToolContext` passed to `attach`.
- Scene mutations go through `UndoManager.execute` with `op*` factories so they are undoable.
- [DoorTool, WindowTool] Attach to existing walls (`DoorTool` via `DoorSystem`; `WindowTool` via `scene.findNearestWall`).

## Side Effects
- Mutate the `SceneStore` through the undo manager; draw transient previews on `EditorPreviewRenderer`; `RulerTool` emits ephemeral events through `ctx.onEphemeralEvent`.

## Verification
- Run: `npm test`
