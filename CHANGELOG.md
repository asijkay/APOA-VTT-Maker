# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] - 2026-09-05

### Added
- **Multiplayer Networking Engine**: Completed PeerJS integration for true Serverless Peer-to-Peer multiplayer.
- **Ephemeral Sync Engine**: Synchronizes actions that don't belong in the permanent map save (like cursors and pings).
- **Multiplayer Cursors**: See where players are pointing on the map in real-time.
- **Map Pinging**: Middle-click or right-click to create an expanding ping animation visible to all players.
- **Networked Ruler Tool**: The distance measurement tool now broadcasts to all connected players in real-time.
- **Secure Role Links**: The Host's control panel now generates explicit "Player Links" and "GM Links" for secure invitations.

## [0.3.0] - 2026-09-04

### Added
- **Functioning Website Architecture**: Transformed the static prototype into a deployable website with routing (`react-router-dom`).
- **Landing Page**: Added a landing page (`/`) to create new rooms.
- **Room Pages**: Rooms now live at specific URLs (`/room/:roomId`).
- **PeerJS Foundation**: Installed `peerjs` in preparation for real-time WebRTC multiplayer syncing.

---

## [0.2.2] - 2026-09-04

### Changed
- **Terminology:** Changed all UI labels from "wu" (World Units) to "px" (Pixels) for better user understanding. The underlying engine logic remains identical (1 wu = 1 screen pixel at 1.0 zoom).

---

## [0.2.1] - 2026-09-04

### Changed
- **Map Settings**: Map dimensions can now go as low as 1x1. Changes are applied via an "Update Map" button instead of firing immediately upon typing.
- **Doors**: Default door width changed to 25wu (minimum adjustable to 10wu).

---

## [0.2.0] – 2026-09-04

### Added
- **Ruler Tool:** Draw temporary lines to measure distances on the map (hotkey `R`).
- **Map Background Uploads:** The Image tool now supports uploading local files to serve as map backgrounds.
- **Wall Moving:** Walls can now be selected (via box selection) and dragged along with other map objects.

---

## [0.1.1] – 2026-09-04

### Added
- **Door Swing Direction:** Added a "Flip Swing Direction" button to the door properties panel to easily change which way the door swings open visually.
- **Player View Restrictions:** Tokens can now be moved by players in Player View, while scene mutations (walls, floors, deleting objects) remain completely blocked.

---

## [0.1.0] – 2026-09-04

### Summary
First meaningful prototype release. A GM can build a room, place doors/windows/lights/tokens, and immediately play with hard-edged line-of-sight and fog-of-war.

---

### Core Engine
- **PixiJS 8 viewport** — full-browser canvas with React UI shell surrounding it
- **Pan & zoom** — middle-mouse pan, scroll-to-zoom centred on cursor
- **Coordinate system** — world coordinates decoupled from screen pixels; `screenToWorld` / `worldToScreen` helpers
- **Camera bounds** — used by all renderers to cull off-screen objects
- **Finite grid** — grid lines drawn only within the defined map boundary; default 25 × 25 cells
- **Adjustable map size** — `mapWidth` / `mapHeight` set via the properties panel (number inputs)
- **Adjustable grid cell size** (`gridSize`) stored in scene data, kept in sync across all tools

---

### Scene Data Model
Serialisable, ID-keyed data types:

| Type | Notable fields |
|------|----------------|
| `FloorTile` | `gridX`, `gridY`, `elevation`, `materialId` |
| `Wall` | endpoints, `blocksVision`, `blocksMovement` |
| `Door` | `wallId`, `position`, `width`, `state` (open/closed), `locked`, `hidden` |
| `Window` | `wallId`, `position`, `width` |
| `Light` | `x`, `y`, `radius`, `color`, `enabled`, `elevation` |
| `Token` | `x`, `y`, `radius`, `visionRadius`, `name`, `imageUrl` |
| `MapImage` | `url`, `x`, `y`, `width`, `height`, `opacity`, `locked` |

---

### Editor Tools

| Tool | Behaviour |
|------|-----------|
| **Select** | Click to select walls/doors/windows/lights/tokens/images; drag to move; Delete to remove |
| **Floor** | Click-drag to paint floor tiles (Bresenham rasterisation) |
| **Erase Floor** | Click-drag to erase floor tiles |
| **Wall** | Click-drag to draw straight walls; snaps to grid intersections; clamped to map boundary |
| **Door** | Hover near a wall → preview; click to place; door attaches to parent wall by normalised position |
| **Window** | Same placement UX as door; windows pass light/vision |
| **Light** | Click to place a coloured point light; adjustable radius |
| **Token** | Click to place a token on the nearest grid cell |
| **Image** | Click to place a map image (background art, overlays) |

---

### Rendering Layers (PixiJS)
Ordered bottom to top:

1. Background
2. Grid
3. Floor tiles
4. Map images
5. Walls
6. Doors & Windows
7. Lights (additive-blend coloured polygons)
8. Tokens
9. Vision overlay (hard-edge LOS polygon)
10. Fog-of-war overlay
11. Editor previews (ghost cursor, wall segment preview)
12. Selection / debug overlays

---

### Vision & Lighting Systems
- **Hard-edged line-of-sight** — visibility polygon via angle-sorted ray casting from each token origin
- Walls block vision; closed doors block vision; open doors pass vision; windows pass vision
- **Per-token fog of war** — cells revealed by any token remain "seen" (greyed); currently visible cells are fully lit
- **Point lights** — each light emits a coloured polygon occluded by walls/doors; additive blend
- Vision and lighting recompute every frame (incremental optimisation deferred)

---

### Collision
- Token movement blocked by walls and closed doors
- Circle-vs-segment resolution with sliding (tokens push along wall surface rather than stopping dead)
- Open doors allow passage

---

### Undo / Redo
- `UndoManager` with an explicit inverse-operation stack (not full snapshots)
- Every user mutation goes through a named `Operation` (`opAddWall`, `opRemoveDoor`, etc.)
- Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts

---

### Persistence
- **Auto-save** to `localStorage` on every scene change (throttled)
- **Export** scene as `.json` file (via browser download)
- **Import** scene from `.json` file (via file picker)
- **New Scene** clears state and storage

---

### GM / Player View
- **GM view** — full editor access; fog overlay is partially transparent (GM sees everything)
- **Player view** — editor tools hidden; only token vision visible; fully opaque fog outside vision

---

### Properties Panel
Shown on right side; content changes with selection:

| Selection | Properties |
|-----------|------------|
| Nothing | Map Width / Height (number inputs) |
| Wall | blocksVision, blocksMovement toggles |
| Door | state (open/closed), locked, position |
| Window | position, width |
| Light | radius, color, enabled |
| Token | name, radius, visionRadius, imageUrl |
| Image | url, width, height, opacity, locked |

---

### Known Limitations / Out of Scope for 0.1.0
- No diagonal walls (axis-aligned only for now)
- No curved walls
- Doors must be placed on an existing wall; minimum 1 grid cell width not enforced yet
- No soft shadows / penumbra
- No multiplayer / WebSockets
- No backend / database
- No authentication
- No dice roller, initiative tracker, character sheets
- Performance not yet profiled on low-end hardware
- Elevation system not implemented
- Mobile not supported

---
