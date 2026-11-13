# engine

## Overview
Composition root of the canvas app. `VttEngine` creates the PixiJS `Application`, scene store, renderers, editor, fog, and input handling, and runs the render ticker. Also holds camera and coordinate helpers.

## Interface
- `VttEngine.ts`: type `DebugStats`; class `VttEngine` with `static create(options)` (options: `container`, `roomId`, `onDebugUpdate`, `onActiveToolChange`, `onSelectionChange`, `onSceneChange`, `onEphemeralEvent`); `getCamera`, `getScene`, `getEphemeralStore`, `getEditor`, `getActiveTool`, `setActiveTool`, `setViewMode`, `getViewMode`, `setLocalPeerId`, `mergeFogMemory(cells, replace)`, `loadScene`, `saveToFile`, `loadFromFile`, `newScene`, `undo`, `redo`, `deleteSelection`, `zoomBy`, `setSnapTokens`, `setDebugOptions`, `setAutoSaveEnabled`, `getDebugStats`, `destroy`.
- `Camera.ts`: types `CameraState`, `ViewportBounds`; class `Camera` (`setViewportSize`, `getState`, `setPosition`, `translate`, `setZoom`, `zoomAt`, `screenToWorld`, `worldToScreen`, `getBounds`).
- `CoordinateSystem.ts`: `MIN_ZOOM` 0.1, `MAX_ZOOM` 8, `ZOOM_STEP` 1.1, `Point2`, `worldToGrid`, `gridToWorld`, `snapWorldToGrid`, `cellCenter`.

## Invariants
- [VttEngine.ts:create] Constructor is private; instances come from async `create`.
- [VttEngine.ts:recomputeDerived] In player view mode, vision is limited to tokens whose `ownerId` equals `localPeerId` (no id means nothing visible).
- [VttEngine.ts:scheduleAutoSave] Autosave is throttled to 1000 ms and skipped when disabled.
- [CoordinateSystem.ts] Zoom is bounded to MIN_ZOOM..MAX_ZOOM.

## Side Effects
- [VttEngine.ts] Creates a Pixi canvas, attaches pointer, wheel, contextmenu, resize listeners and a ticker; removes them in `destroy`.
- [VttEngine.ts:scheduleAutoSave] Writes the scene to localStorage via `PersistenceService`.
- [VttEngine.ts:saveToFile, loadFromFile] Trigger file download / file picker.

## Verification
- Run: `npm test`
