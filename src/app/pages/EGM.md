# Pages

## Overview
Route-level React components. `Home` is the static landing page that creates rooms. `Room` is the live VTT screen: it wires the PixiJS engine (`VttEngine`), the UI panels, and the PeerJS-based `NetworkService` together.

## Interface
- `Home.tsx`: `default export Home()` renders the landing page. Internal (non-exported) `HeroMap()` draws an inline SVG sample map; constants `STEPS` and `FEATURES` hold marketing copy.
  - `handleCreateRoom` generates a random id via `Math.random().toString(36).substring(2, 9)` and navigates to `/room/<id>?role=gm`.
  - Reads the global `__APP_VERSION__` for the footer.
- `Room.tsx`: `default export Room()` renders the room for `:roomId`.
  - Query params: `role=gm` (requests GM) and `key` (GM key), resolved with `resolveGmKey(roomId, urlKey, wantsGM)`. Identity comes from `loadIdentity()`.
  - Composes `VttViewport`, `Toolbar`, `TopBar`, `PropertiesPanel`, `PlayersPanel`/`MeCard`, `ZoomControls`, `DebugHud` from `@/ui/*`.
  - Creates `NetworkService` in `handleEngineReady` and sets its callbacks `onStatusChange`, `onPlayersChange`, `onFogMemory`, `onRoleChange`.
  - Uses `loadTestRoom` for demo scenes and `engine.saveToFile()`, `loadFromFile()`, `newScene()`, `undo()`, `redo()`, `zoomBy()`.

## Invariants
- `canGM` reflects what the host granted, not the URL. It starts as `gmKey !== null` and is overwritten in `onRoleChange`; a host (`role.isHost`) is always treated as GM.
- Editing UI (`Toolbar`, `PropertiesPanel`, `PlayersPanel`) renders only when `editing = canGM && viewMode === 'gm'`; otherwise `MeCard` is shown.
- If the role is not GM, `viewMode` is forced to `'player'` and `activeTool` to `'select'`.
- The initial view mode is applied in `handleEngineReady` because the view-mode effect runs before the engine exists.
- `playerLink()` deletes the `role` and `key` params, so the GM key is never placed in a player link.
- Only the host autosaves: `setAutoSaveEnabled(role.isHost)`.
- Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo.

## Side Effects
- `Room` registers a window `keydown` listener (removed on unmount).
- `Room` opens a PeerJS connection via `new NetworkService(...).init()`, and calls `networkRef.current?.destroy()` on unmount.
- `Room` assigns debug hooks `window.__engine` and `window.__network`.
- `handleNewScene` calls `window.confirm` before `engine.newScene()`.
- `Home` navigates via react-router (`useNavigate`).
- Save/load goes through engine file operations; scene data is persisted by the engine, not by these pages.

## Verification
- Run: `npm test`
