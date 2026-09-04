# APOA VTT Maker (v0.3.0)

A browser-based Virtual Tabletop (VTT) prototype where map creation and VTT gameplay happen in the same environment.

## Current Milestone

**Milestone 8: v0.3.0 (Functioning Website)**
- Restructured the static prototype into a functioning website using `react-router-dom`.
- Added Landing Page (`/`) and unique Room URLs (`/room/:id`).
- Laid foundation for WebRTC Peer-to-Peer multiplayer using `peerjs`.

---

## The Problem with Traditional VTTs

```
Map maker → export static image → import into VTT → redraw walls
         → recreate doors → recreate lighting → configure line of sight
```

## Our Approach

```
Place floor → draw wall → place door → place light → place token → immediately play
```

Map objects are **semantic game objects**, not pixels.

- **Wall** = visual object + blocks vision + blocks movement  
- **Door** = attached to wall + open/closed state + interactive  
- **Light** = visual object + emits coloured light  
- **Token** = player-controlled + vision origin  
- **Window** = configurable vision/light/movement behaviour  

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| UI Shell | React 18 |
| Build | Vite |
| Map Renderer | PixiJS 8 |

React handles the toolbar, panels, and dialogs. PixiJS handles everything on the map canvas. The two are kept strictly separate.

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Other Commands

```bash
npm run build       # Production build
npm run typecheck   # TypeScript type check (no emit)
npm run test        # Run unit tests (Vitest)
npm run lint        # ESLint
```

---

## Features (v0.1.1)

### Editor Tools

| Tool | How to Use |
|------|-----------|
| **Select** | Click any object to select it. Drag to move. `Delete` to remove. |
| **Floor** | Click and drag to paint floor tiles. |
| **Erase Floor** | Click and drag to erase floor tiles. |
| **Wall** | Click and drag to draw a wall. Snaps to grid intersections. |
| **Door** | Hover near a wall to preview. Click to place. |
| **Window** | Hover near a wall to preview. Click to place. |
| **Light** | Click to place a coloured point light. |
| **Token** | Click to place a token. |
| **Image** | Click to place a map image (background art / overlays). |

### Navigation

| Action | Input |
|--------|-------|
| Pan | Middle-mouse drag |
| Zoom | Scroll wheel (centred on cursor) |

### Vision & Lighting
- Hard-edged line-of-sight from each token
- Walls block vision and movement
- Closed doors block vision and movement; open doors allow both
- Windows allow vision and light to pass through
- Per-token fog-of-war (explored cells remembered in grey)
- Coloured point lights with wall occlusion

### GM / Player View
- **GM View** — full editor access; semi-transparent fog (GM sees everything)
- **Player View** — editor hidden; hard fog outside token vision

### Undo / Redo
`Ctrl+Z` / `Ctrl+Shift+Z`

### Save & Load
- Auto-saves to `localStorage` on every change
- Export scene as `.json`
- Import scene from `.json`
- New Scene (clears everything)

---

## Map Settings

Click anywhere on the empty canvas (no object selected) to open **Map Settings** in the right panel:

- **Width** — number of grid columns (default: 25)
- **Height** — number of grid rows (default: 25)

---

## Project Structure

```
src/
├── app/
│   └── App.tsx                  # Root React component
├── ui/
│   ├── Toolbar.tsx              # Left toolbar
│   └── PropertiesPanel.tsx      # Right properties panel
└── vtt/
    ├── engine/
    │   ├── VttEngine.ts         # Main engine; owns PixiJS app + all systems
    │   ├── Camera.ts            # Pan/zoom state + bounds
    │   └── CoordinateSystem.ts  # World ↔ screen ↔ grid helpers
    ├── scene/
    │   ├── SceneTypes.ts        # Data model (Wall, Door, Token, …)
    │   ├── SceneStore.ts        # Mutable scene state + event bus
    │   ├── UndoManager.ts       # Inverse-operation undo stack
    │   └── PersistenceService.ts
    ├── editor/
    │   ├── EditorController.ts  # Tool routing + keyboard shortcuts
    │   └── tools/               # One file per editor tool
    ├── renderer/                # One PixiJS renderer per object type
    ├── geometry/                # Pure geometry: intersections, collision, visibility
    └── systems/
        ├── VisionSystem.ts      # Visibility polygon (ray casting)
        ├── LightingSystem.ts    # Per-light polygon
        ├── FogSystem.ts         # Fog-of-war cell tracking
        └── MovementSystem.ts    # Token collision resolution
```

---

## Architecture Principles

1. **Scene state is separate from rendering.** `SceneStore` is the single source of truth; renderers read from it each frame.
2. **Map objects are semantic.** A door's open/closed state is game data, not a visual hack.
3. **Coordinate systems are explicit.** World units, grid coordinates, and screen pixels are never mixed implicitly.
4. **No backend.** Everything runs in the browser. Multiplayer is out of scope for this prototype.
5. **Undo/redo is operation-based.** Every mutation has an explicit inverse — no full snapshot diffing.

---

## Roadmap

See [CHANGELOG.md](./CHANGELOG.md) for the full history.

### Planned for v0.2.0
- [ ] Diagonal walls
- [ ] Door/window placement fixes (minimum 1-cell width, correct open-arc direction)
- [ ] Robust token collision (no jumping over thin walls)
- [ ] GM view vs Player view enforcement

---

## Product Principles

1. The GM decides; the system expresses.
2. The map is game state, not a background.
3. Environment objects can have behaviour.
4. Dynamic vision and lighting are foundational.
5. Map editing remains available during play.
6. Performance on low-end laptops is a hard long-term requirement.

---

## Out of Scope (for now)

Authentication · Backend · Database · Multiplayer · WebSockets · Dice roller · Initiative tracker · Character sheets · Spell automation · Hex grids · Curved walls · Freehand caves · Elevation system · Mobile support · Procedural generation · AI generation · Voice/video chat
