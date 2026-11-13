# UI Components

## Overview
React presentational and editor-panel components for the VTT: top bar, tool palette, properties inspector, players panel, zoom controls, debug HUD, and the viewport that hosts the PixiJS `VttEngine`. Components are mostly prop-driven; only `PropertiesPanel` and `VttViewport` talk to the engine/scene store directly. Leaf directory (no subdirectories).

## Interface
- `VttViewport.tsx`: default `VttViewport({ roomId?, onDebugUpdate?, activeTool, onActiveToolChange?, onSelectionChange?, onSceneChange?, onEphemeralEvent?, engineRef?, onEngineReady? })` - mounts a div and creates a `VttEngine` via `VttEngine.create`.
- `PropertiesPanel.tsx`: default `PropertiesPanel({ selectedIds, engine, sceneVersion, players?, selfId? })` - inspector for the selection. Multi-select shows bulk delete. No selection shows the map settings panel. Single selection shows an editor for wall, door, window, light, token, or map image.
- `Toolbar.tsx`: default `Toolbar({ activeTool, onToolChange })` - grouped tool buttons for `EditorTool` ids `select, floor, erase-floor, wall, door, window, light, token, image, ruler` (hotkeys V F E W D I L T M R as labels).
- `TopBar.tsx`: default `TopBar(props)` - room name, status pill, GM/player view switch, link copy buttons, save/load, overflow menu (snap tokens, debug vision, debug collision, demo maps, clear scene). Also exports `describeStatus(status, playerCount)` and type `StatusLevel` (`'on' | 'warn' | 'off'`).
- `PlayersPanel.tsx`: default `PlayersPanel({ players, selfId, tokens })` (GM roster) and named export `MeCard({ selfId, tokens })` (player-view own-token card).
- `ZoomControls.tsx`: default `ZoomControls({ zoom, onZoomIn, onZoomOut })`.
- `DebugHud.tsx`: default `DebugHud({ stats })` - shows camera, zoom, and mouse world coordinates from `DebugStats`.
- External dependencies: `@/vtt/engine/VttEngine`, `@/vtt/scene/SceneTypes`, `@/vtt/scene/UndoManager` (`opUpdateSceneSettings`), `@/vtt/network/protocol` (`PlayerInfo`), `lucide-react`.

## Invariants
- `VttViewport` creates the engine exactly once per mount (effect with empty deps) and destroys it on unmount. If unmounted before async creation resolves, the late engine is destroyed (`disposed` flag).
- `VttViewport` syncs `activeTool` to the engine only when `engine.getActiveTool()` differs, avoiding set loops.
- `PropertiesPanel` calls all hooks before its early returns; keep any new hooks above them. `sceneVersion` is unused except to force re-render.
- `PropertiesPanel` map settings clamp width and height to 1..200 cells. Token size is clamped to 5..100.
- Map setting changes go through the undo manager (`engine.editor.getUndoManager().execute(opUpdateSceneSettings(...))`). Other property edits call `SceneStore.update*` directly.
- A locked map image cannot be deleted from the panel (`DeleteButton disabled={img.locked}`).
- `Toolbar` `GROUPS` is the single source for tool order, labels, and hotkeys. The hotkeys are display labels only; key handling lives elsewhere.
- `describeStatus` matches NetworkService status strings by prefix or keyword regex. Unrecognized strings map to level `off` / "Offline".
- `PlayersPanel` always lists the local user as "You" (GM) and filters `selfId` out of `players`. A player with no named token is called `Player <first 4 chars of id>`.
- `TopBar` GM-only controls (GM link, Save, Load, scene menu) render only when `canGM`. The GM link also requires `gmLink`.

## Side Effects
- `VttViewport`: creates and destroys a PixiJS engine (canvas in the host div) and sets `window.__engine`. It invokes `onEngineReady` and `onDebugUpdate`.
- `TopBar`: writes to the clipboard (`navigator.clipboard.writeText`), falls back to `window.prompt` if blocked, and sets a 1.8 s timer to clear the "Copied" state (cleared on unmount). While the menu is open it registers document `mousedown` and `keydown` (Escape) listeners, removed on close.
- `PropertiesPanel`: mutates the scene (`updateWall/Door/Light/Token/Window/Image`), `engine.deleteSelection()`, and undoable scene settings. Uploads use `FileReader.readAsDataURL`, so images are embedded as data URLs in the scene.

## Verification
- Run: `npm test`
