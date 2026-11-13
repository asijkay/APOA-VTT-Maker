# renderer

## Overview
PixiJS draw layers for the scene. Each renderer owns a Pixi container, is fed scene data and a `Camera`, and redraws on `update` (many use dirty flags). Instantiated and ordered by `engine/VttEngine`.

## Interface
- `GridRenderer`, `FloorRenderer` (also exports `screenRect`), `WallRenderer`, `DoorRenderer`, `WindowRenderer`, `ImageRenderer`, `TokenRenderer`: `update(scene, camera, ...)`, `destroy()`; most also `setSelection(ids)`. `TokenRenderer.update(scene, camera, visibleCells, viewMode, localOwnerId)`.
- `LightRenderer` (`setLightResults`, `markDirty`), `VisionRenderer` (`setVisionResults`, `setDebugMode`), `AmbientLightRenderer` (`setAmbientLight(level, color)`), `FogRenderer` (`updateCells(revealed, visible)`, `setVisible`, `isVisible`): consume results from `../systems`.
- `EditorPreviewRenderer`: types `PreviewFloorCell`, `PreviewWallSegment`; `setCamera`, `showGridCursor`, `showCells`, `showWallSegment`, `showSelectionBox`, `showRuler`, `clear`, `getContainer`.
- `PresenceRenderer`: constructed with an `EphemeralStore`; `update()` draws remote cursors, pings, rulers.

## Invariants
- [All renderers except `PresenceRenderer`] Take a Pixi `Container`/`stage` parent in the constructor and must be `destroy()`ed to release display objects. `PresenceRenderer` is built from an `EphemeralStore`, exposes its own `container` for the engine to add to the stage, and has no `destroy()`.
- [WallRenderer, FloorRenderer, DoorRenderer, WindowRenderer, ImageRenderer, TokenRenderer, LightRenderer, VisionRenderer, AmbientLightRenderer, FogRenderer] Expose `markDirty()` for forced redraw. `GridRenderer`, `EditorPreviewRenderer` and `PresenceRenderer` do not.
- [TokenRenderer.update] Visibility depends on `viewMode` (`gm` or `player`) and `visibleCells`.
- Renderers read scene data and do not mutate the `SceneStore`.

## Side Effects
- Create and mutate PixiJS display objects; `ImageRenderer` and `TokenRenderer` load textures from URLs asynchronously.

## Verification
- Run: `npm test`
