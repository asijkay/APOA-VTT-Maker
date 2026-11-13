# VTT Core Blueprint

## System Overview
`src/vtt` is the TypeScript core of the virtual tabletop: a PixiJS canvas engine, an authoritative scene model, geometry and vision/lighting/fog rules, an editor with per-tool controllers, and host-authoritative PeerJS multiplayer. The directory itself holds no source files. `engine/VttEngine` composes the pieces; `scene/SceneStore` is the single source of truth; `network` syncs it as validated per-viewer deltas.

## Subdirectories & System Boundaries
- engine: [./engine/EGM.md](./engine/EGM.md) - `VttEngine`, `Camera`, coordinate helpers; composition root and render loop.
- scene: [./scene/EGM.md](./scene/EGM.md) - Scene types, `SceneStore`, `UndoManager`, `EphemeralStore`, persistence.
- geometry: [./geometry/EGM.md](./geometry/EGM.md) - Pure segment, cell, visibility, and collision math.
- systems: [./systems/EGM.md](./systems/EGM.md) - Vision, lighting, fog, and door logic.
- renderer: [./renderer/EGM.md](./renderer/EGM.md) - PixiJS layer renderers.
- editor: [./editor/EGM.md](./editor/EGM.md) - `EditorController`, selection; tools in [./editor/tools/EGM.md](./editor/tools/EGM.md).
- network: [./network/EGM.md](./network/EGM.md) - PeerJS host/client sync, validation, authorization, view filtering, identity.

## Global Invariants
- Dependency direction: `geometry` and `scene` types are shared by all. `systems` builds on `geometry`. `renderer` takes only result types from `systems` (type-only imports) and runs `geometry` code; `network` runs `geometry` and `systems/VisionSystem`. `engine` depends on everything else.
- Only the host applies authoritative changes; clients send deltas that pass `validateDelta` and `authorizeDelta`.
- Scene edits made by tools go through `UndoManager`.

## Global Side Effects
- localStorage: scene autosave (`vtt-scene-v1[:room]`), identity (`vtt-identity-v1`), GM key (`vtt-gmkey-v1:<room>`), bindings (`vtt-bindings-v1:<room>`), fog memory (`vtt-fog-v1:<room>`).
- WebRTC/PeerJS connections to room peer `vtt-maker-room-<roomId>`.
- Pixi canvas and DOM event listeners; file download/upload for scene export/import.

## System Verification
- Run: `npm test`
