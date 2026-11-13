# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.8.0] - 2026-11-13

### Changed: full visual redesign (midnight, slate and tosca)
- **New palette.** Four colours do the work: Midnight Charcoal `#0F172A`, Dark Slate `#1E293B`, Pure White and Electric Tosca `#2DD4BF`. Three greys support them, and two signals each have one job: rose (danger, offline, monsters) and amber (torchlight, reconnecting). Defined once as CSS variables in `src/index.css`.
- **Landing page rebuilt**: hero with a sample map, the build-to-play flow, six features, closing call to action. Responsive.
- **Room UI rebuilt**: grouped toolbar with hover tooltips (name and hotkey), a top bar (room, live status pill, GM badge, GM/Player switch, invite links, Save/Load, menu), a players panel, a "your token" card for players, zoom buttons, and a restyled properties panel. The old floating control panel is gone; its options live in the ··· menu.
- **The map matches the UI.** Grid, floors, walls, doors, windows, fog, previews and selection are recoloured. Tokens are coloured by owner (yours tosca, another player's soft grey, unowned rose) and show their initial. Lights now glow from their source and fade with distance, still cut off by walls and closed doors, instead of a flat wash.
- Typography: Cormorant Garamond for headings, Inter for controls (loaded from Google Fonts with system fallbacks).
- Link buttons show "Copied" inline instead of a blocking `alert()`.
- Responsive top bar: link buttons collapse to icons and Save/Load move into the menu on narrow windows.

### Added
- Token panel: hidden-from-players switch, elevation, upload button, and a hint showing whether the owner is online.
- Delete button on every object's panel (one undoable step); zoom buttons; players panel with each player's token count.
- A real favicon (the old one pointed at a file that didn't exist).

### Fixed
- Switching to player view left tokens outside your vision visible until something else redrew them.

### Known limitations
- `tests/e2e/vtt.spec.ts` targets a UI from before routing existed and no longer matches the app (it was already stale; not touched here).
- Player names don't exist yet, so players are shown by the token they own (or the start of their id).
- Fonts load from Google Fonts; offline, the system serif and sans are used.

## [0.7.0] - 2026-11-13

### Security
- **Map layout is now filtered per player.** Walls, doors, windows, floors, lights and map images are only sent for what is within a player's sight range or was explored before. Nothing about unexplored rooms leaves the host. (A map image is still sent whole once any part of it is seen.)
- **The host checks where a player moves a token.** A move is clamped to the map and swept against walls and closed doors, so a forged position can't teleport a token through a wall; a large correction resyncs the sender.
- **Per-connection rate limit** (token bucket; repeat offenders are disconnected) and a **hello timeout** that drops connections that never identify themselves.
- A player (no GM key) **never claims host**, so a stranger opening the link first can't take over a GM's room.

### Added
- **Reconnection.** Clients retry with backoff when the host disappears and show a banner while offline. A host whose signalling socket drops re-registers its room. A GM client takes over a vacated room with the last scene it mirrored.
- **Fog memory lives on the host** per player (persisted across host reloads) and is sent on join, so exploration survives a refresh.
- **TURN/STUN support** via `VITE_ICE_SERVERS` (JSON) for players behind strict NAT.
- **ESLint** (`npm run lint`) with typescript-eslint and the React hooks rules; lint now runs in CI.

### Fixed
- **PropertiesPanel crashed when selecting an object after an empty selection** (hooks were called after early returns).
- **Selection changes didn't always update the panel** (clear, shift-click toggle, add/remove reused the same Set, so React skipped the update); every selection change now produces a new Set.
- Cursor labels showed "GM" for everyone; they now show the actual role/player.
- Token drag deep-copied the whole scene on every collision sub-step; it now uses one shared swept-move that builds the wall list once.
- Players no longer see GM-only controls (demo loaders).

### Changed
- Code-split: the landing page no longer loads PixiJS/PeerJS (separate `pixi` and `peer` chunks).
- Room panel and landing page styling moved from inline styles to CSS classes.

### Known limitations
- The host's browser tab is still the server; a GM must stay online. (A GM client can take over if they were connected.)
- `PropertiesPanel.tsx` still has inline styles, and 27 `any` types remain (reported as lint warnings).
- Diagonal walls remain out of scope per AGENTS.md.

## [0.6.1] - 2026-11-13

### Security
- **Host-authoritative multiplayer.** Clients no longer overwrite the host's scene. They send deltas and the host decides what to accept: a player may only change the `x`/`y` of tokens they own. Walls, settings, removals, new tokens, ownership and vision changes from a player are dropped, and the sender is resynced. The old whole-scene `SCENE_SYNC` message is gone.
- **Real GM role.** GM rights now require a secret key (`?role=gm&key=…`, generated by the host and carried only by the GM Link). Editing `?role=gm` in the URL no longer grants anything. Non-GMs can't toggle GM view, and the GM Link, Scene Controls and toolbar are hidden for them.
- **Per-viewer filtering on the host.** Players are only sent their own tokens plus tokens currently inside their vision. Hidden tokens, secret doors and other players' owner ids never leave the host.
- **Validation of all network input.** Scenes, deltas and cursor/ping/ruler events are strictly validated (types, ranges, sizes, colors, image URLs; unknown fields dropped). Ephemeral events are stamped with the sender's real peer id, so they can't be spoofed.

### Fixed
- **Token ownership survives a refresh.** Ownership is bound to a stable per-browser player id (with a secret, so another player can't claim it) instead of the random PeerJS id. The GM picks owners from the connected-player list.
- **Players joining via link were running the engine in GM mode** (no fog, no ownership filter) until they toggled the view.
- **Autosave is per room** (`vtt-scene-v1:<room>`), and joined clients no longer autosave the host's scene.
- The network connection is closed when leaving a room.

### Performance
- Vision, fog memory and lighting are recomputed only when the scene, view mode or player changes, not every frame. Rendering reads the live scene instead of deep-copying it (including image data) 60 times a second.
- Scene sync sends only the objects that changed, coalesced to ~30 ms.

### Tooling
- Tests and the Playwright config are no longer git-ignored; added a GitHub Actions workflow (typecheck, tests, build).

### Known limitations
- Walls, floors, windows, lights and map images are still sent to players in full (the client draws them from fog memory), so a hostile client can read the map layout.
- The host's browser tab is the server: if it closes, the room is gone. The GM must open the room first; a player who opens it first becomes the host.

## [0.6.0] - 2026-09-07

### Added
- **Global Illumination (Prototype 2 - Phase 1)**: Added an `ambientLightLevel` and `ambientLightColor` setting to the Map Properties. Allows for Day/Night modes that interact dynamically with point lights.
- **Advanced Selection**: Added marquee / box-select functionality to the Select Tool.
- **Interaction Hints**: Added a persistent, unobtrusive on-screen overlay explaining panning and zooming mechanics to new users.

### Changed
- **UX & Aesthetics**: Reorganized the Room panel to reduce clutter, enhanced the visibility of active toolbar icons with primary-colored edge highlights, and brightened muted text elements for better contrast against dark panels.

### Fixed
- **Scene Settings Undo/Redo**: Fixed a TypeScript bug in `UndoManager` preventing the map from building correctly on Vercel due to missing ambient light properties.

## [0.5.0] - 2026-09-05

### Added
- **Token Ownership (Prototype 1 - Phase 1)**: Players can now only interact with tokens assigned to them.
- **Individual Vision Filtering**: The map viewport dynamically filters Line of Sight, ensuring players only see the vision radius from their own assigned tokens. GMs continue to see all tokens.
- **Token Owner Assignment**: The GM can now assign tokens to specific players via the Properties Panel by entering their Peer ID.
- **Player Movement Restrictions**: Players are prevented from selecting or dragging tokens they do not own.
- **Premium UI Overhaul (Prototype 1 - Phase 2)**: Added a sleek, modern UI with a cohesive design system using dark mode, glassmorphism, and subtle micro-animations.
- **Lucide Icons**: Replaced plain text labels with modern `lucide-react` iconography for all tools.
- **Enhanced Properties Panel**: Improved usability of property controls with CSS toggle switches, styled range sliders, and modern layouts.
- **Fog of War Memory (Prototype 1 - Phase 3)**: Implemented exploration memory. Previously seen areas are now shrouded in a darkened, semi-transparent fog instead of pitch black.
- **Dynamic Object Hiding**: In Player mode, tokens that are outside of the currently active Line of Sight are completely hidden, even if they are in the memory fog. Map layouts (walls, doors) remain visible.

## [0.4.1] - 2026-09-05

### Fixed
- **Vercel 404 Routing**: Added `vercel.json` to properly rewrite all routes to `index.html`, fixing the 404 error when navigating directly to a Room URL or refreshing the page.

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
