# scene

## Overview
Authoritative scene model and its data services: types, the mutable `SceneStore`, undo/redo, ephemeral presence state, localStorage/file persistence, and test-room fixtures.

## Interface
- `SceneTypes.ts`: types `ID`, `FloorTile`, `Wall`, `Door`, `Window`, `Light`, `Token`, `MapImage`, `Scene`, `EditorTool` (`select|floor|erase-floor|wall|door|window|light|token|image|ruler`); `createEmptyScene()`.
- `SceneStore.ts`: `genId`, types `SceneChange`, `SceneListener`, `FloorTileInput`, `WallInput`, `TokenInput`, `DoorInput`, `WindowInput`, `LightInput`; class `SceneStore` with `snapshot`, `peek`, `getRevision`, `subscribe`, `serialize`, `replace(scene, source)`, `updateSceneSettings`, and per-entity operations:
  - floor tiles (no update): `addFloorTile`, `addFloorTilesBulk`, `removeFloorTile`, `removeFloorTileAt`, `removeFloorTilesBulkAt`, `findFloorByCell`.
  - walls: `addWall`, `updateWall`, `removeWall`, `findWallById`, `findNearestWall`.
  - tokens: `addToken`, `updateToken`, `removeToken`, `findTokenById`, `findTokenNear`.
  - doors, lights, windows, images: `add*`, `update*`, `remove*`, `find*ById`, plus `findDoorNear`, `findLightNear`, `findWindowNear`, `findImageNear`.
- `UndoManager.ts`: type `Operation {label, apply, inverse}`; class `UndoManager` (`execute`, `executeQuiet`, `undo`, `redo`, `canUndo`, `canRedo`, `clear`, `pushOperation`, static `snapshotOp`); factories `opAddWall`, `opRemoveWall`; `opAddDoor`, `opRemoveDoor`, `opUpdateDoor`; `opAddToken`, `opRemoveToken`, `opMoveToken`; `opAddLight`, `opRemoveLight`, `opUpdateLight`; `opAddWindow`, `opRemoveWindow`, `opUpdateWindow`; `opAddImage`, `opRemoveImage`, `opUpdateImage`; `opBatch`, `opUpdateSceneSettings`. There are no wall/token `opUpdate*` factories (tokens move through `opMoveToken`) and no floor factories.
- `EphemeralStore.ts`: types `CursorState`, `PingState`, `RulerState`; class `EphemeralStore` (public fields `cursors`, `pings`, `rulers`; methods `subscribe`, `notify`, `updateCursor`, `addPing`, `updateRuler`, `removeRuler`, `cleanup`).
- `PersistenceService.ts`: `storageKeyFor(roomId?)`, object `PersistenceService` (`saveToLocalStorage`, `loadFromLocalStorage`, `clearLocalStorage`, `exportToFile`, `importFromFile`).
- `TestRooms.ts`: `loadTestRoom(store, roomId)`.

## Invariants
- [SceneStore.ts:SceneListener] Listeners receive `source: 'local' | 'network'`; `NetworkService` only flushes `local` changes from clients.
- [UndoManager.ts:MAX_STACK] History is capped at 100 operations; `execute` clears the redo stack.
- [UndoManager.ts] Mutations by tools should go through `execute(op)` so inverses are recorded.
- [PersistenceService.ts:storageKeyFor] Autosave key is `vtt-scene-v1` or `vtt-scene-v1:<roomId>`, one slot per room.
- [PersistenceService.ts:coerceScene] Missing arrays default to empty so old saves load; corrupt data yields `null`.

## Side Effects
- [PersistenceService.ts] Reads/writes/removes `localStorage` (errors swallowed); `exportToFile` creates a Blob and triggers a download; `importFromFile` opens a file picker.
- [SceneStore.ts:emit] Notifies subscribers synchronously on each mutation.
- [TestRooms.ts:loadTestRoom] Clears the store's floors, walls, doors, lights, and tokens before adding fixtures.

## Verification
- Run: `npm test`
