You are my senior software engineer and implementation partner. We are building a browser-based Virtual Tabletop prototype focused on interactive map creation.

Your job is to IMPLEMENT the project, not merely explain how to build it.

# PROJECT VISION

We are building a VTT where:

"Your map is an interactive game environment."

The key differentiator is that map creation and VTT gameplay happen in the same application.

Traditional workflow:

Map maker
→ export static image
→ import into VTT
→ redraw walls
→ recreate doors
→ recreate lighting
→ configure line of sight

Our workflow:

Place floor
→ draw wall
→ place door
→ place light
→ place token
→ immediately play

Map objects are semantic game objects, not merely pixels.

Examples:

- Wall = visual object + blocks vision + blocks movement
- Door = attached to wall + open/closed state + interactive
- Light = visual/game object + emits colored light
- Token = player-controlled object + vision origin
- Window = configurable vision/light/movement behavior

# PRODUCT PRINCIPLES

1. The GM decides; the system expresses.
2. The map is game state, not a background.
3. Environment objects can have behavior.
4. Dynamic vision and lighting are foundational.
5. Elevation exists without requiring 3D.
6. Large maps should eventually feel continuous.
7. Rules interpretation mostly belongs to the GM.
8. Map editing remains available during play.
9. Multiplayer collaboration will eventually be native.
10. Performance on low-end laptops is a hard long-term requirement.

# IMPORTANT SCOPE RULE

DO NOT build the full VTT yet.

DO NOT add features merely because a normal VTT has them.

DO NOT implement speculative future architecture unless necessary for the current prototype.

We are building PROTOTYPE 0 only.

The prototype exists to prove one interaction:

"A GM can create a room, place a door, place a token, and opening the door immediately changes line of sight."

# REQUIRED TECH STACK

Use:

- TypeScript
- React
- Vite
- PixiJS

React is for application UI only.

Examples:

- toolbar
- side panels
- buttons
- property inspectors
- dialogs

PixiJS is for the map viewport only.

Examples:

- grid
- floor tiles
- walls
- doors
- lights
- tokens
- vision rendering

DO NOT render map objects as React DOM elements.

Keep React UI state and PixiJS rendering responsibilities clearly separated.

Use the current stable APIs available in the installed dependency versions. Before writing integration code, inspect the actual installed package versions and adapt to them. Do not assume outdated PixiJS APIs.

# PROTOTYPE 0 SCOPE

Implement only:

1. Browser page
2. PixiJS map viewport
3. Infinite-feeling grid
4. Pan
5. Zoom
6. Floor painting
7. Floor erasing
8. Horizontal and vertical wall drawing
9. Door placement onto walls
10. Door open/closed state
11. Door movement along its wall
12. Door deletion
13. One or more tokens
14. Hard line-of-sight visibility
15. Light placement
16. Light radius
17. Colored lights
18. Walls block vision
19. Closed doors block vision
20. Open doors allow vision
21. Basic wall movement blocking for tokens

Explicitly OUT OF SCOPE:

- authentication
- user accounts
- database
- backend
- cloud storage
- multiplayer
- WebSockets
- D\&D character sheets
- initiative
- dice roller
- spell automation
- conditions
- plugins
- AI generation
- mobile support
- hex grids
- gridless mode
- curved walls
- freehand caves
- full elevation system
- multiple floors
- fog memory
- animated assets
- asset marketplace
- voice chat
- video chat
- 3D dice
- procedural generation

Do not implement out-of-scope features unless I explicitly approve them.

# CORE UX

The page should have a simple application shell.

Left toolbar:

- Select
- Floor
- Erase Floor
- Wall
- Door
- Light
- Token

Center:

- PixiJS map viewport

Optional small right panel:

- properties of selected object

The UI can be ugly but must be usable.

Prioritize interaction quality over visual polish.

# MAP COORDINATE SYSTEM

Use world coordinates independent from screen coordinates.

The viewport must support:

- panning
- zooming
- screen-to-world conversion
- world-to-screen conversion

Do not bake object positions into screen pixels.

Use a configurable square grid.

Default:

GRID\_SIZE = 50 world units

The grid should appear infinite by rendering only the visible grid lines based on camera bounds.

Do not create millions of grid objects.

# DATA MODEL

Keep scene state separate from rendering.

Start with a serializable scene model similar to:

type Scene = {
floors: FloorTile\[]
walls: Wall\[]
doors: Door\[]
lights: Light\[]
tokens: Token\[]
}

Use IDs for objects.

Suggested types:

type FloorTile = {
id: string
gridX: number
gridY: number
elevation: number
materialId?: string
}

type Wall = {
id: string
x1: number
y1: number
x2: number
y2: number
elevation: number
blocksVision: boolean
blocksMovement: boolean
}

type Door = {
id: string
wallId: string
position: number
width: number
state: "open" | "closed"
locked: boolean
hidden: boolean
}

type Light = {
id: string
x: number
y: number
elevation: number
radius: number
color: string
enabled: boolean
}

type Token = {
id: string
x: number
y: number
elevation: number
radius: number
visionRadius: number
}

These are starting suggestions, not immutable requirements. If implementation reveals a cleaner model, explain the reason before making a major structural change.

# CRITICAL DOOR ARCHITECTURE

Do NOT destructively cut and repair wall geometry every time a door moves.

The wall remains the source geometry.

A door is attached to a wall:

Wall

- door position along wall
- door width
- door state

For line of sight and movement blocking:

Closed door:

- door opening behaves as blocked

Open door:

- door opening behaves as passable

Moving a door:

- update its position along the wall

Deleting a door:

- remove the opening behavior

The original wall geometry remains intact.

Implement helper functions that derive effective blocking segments from:

- base wall geometry
- attached doors
- door states

Example concept:

getEffectiveVisionSegments(scene)

getEffectiveMovementSegments(scene)

These derived segments should be used by LoS and collision systems.

# WALL RULES FOR PROTOTYPE

For Prototype 0:

- walls may only be horizontal or vertical
- wall endpoints snap to grid intersections
- diagonal walls are out of scope
- curved walls are out of scope
- walls block vision
- walls block token movement

Keep the geometry implementation simple and reliable.

# FLOOR PAINTING

Floor tool:

- click and drag across grid cells
- paint floor tiles
- avoid duplicate tiles in the same cell/elevation

Erase Floor tool:

- click and drag
- remove floor tiles

Floor rendering can initially use simple colored rectangles.

Do not build an asset system yet.

# DOOR PLACEMENT

Door tool behavior:

1. User selects Door tool
2. User points near a wall
3. Find nearest valid wall
4. Preview door placement
5. Snap/project placement onto that wall
6. Click to place
7. Door stores wallId and normalized position along wall
8. Door has a width
9. Door can toggle open/closed
10. Door can be selected
11. Door can move along its parent wall
12. Door can be deleted

If no wall is near enough, placement should fail gracefully.

For Prototype 0, doors only need to work on horizontal and vertical walls.

# TOKEN BEHAVIOR

Token tool:

- click map to place token
- token is draggable
- token position exists in world coordinates

Movement:

- walls block movement
- closed doors block movement
- open doors allow movement

For Prototype 0, use a simple reliable collision approach.

Do not build D\&D movement rules.

Do not calculate whether movement is legally allowed by game rules.

# LINE OF SIGHT

This is the heart of the prototype.

Implement hard-edged visibility.

Requirements:

- token is a vision origin
- walls block LoS
- closed doors block LoS
- open doors allow LoS
- visibility updates immediately when:
  - token moves
  - wall changes
  - door opens
  - door closes
  - door moves
  - door is deleted

No soft shadows.

No full 3D LoS.

No elevation-aware LoS yet.

Use a visibility polygon or ray-casting approach appropriate for 2D wall segments.

Prioritize correctness and debuggability over clever optimization.

For early implementation, a common approach is:

- collect segment endpoints
- cast rays toward endpoint angle
- also cast slightly before and after each endpoint angle
- find nearest segment intersection
- sort resulting points by angle
- build visibility polygon

Add a small epsilon around endpoint angles to avoid missing corners.

Keep geometry functions pure where practical.

# LIGHTING

After token LoS works correctly, add lights.

Light behavior:

- position
- radius
- color
- enabled state

Requirements:

- walls block light
- closed doors block light
- open doors allow light
- hard-edged light visibility is acceptable
- no soft shadows
- no flicker
- target eventually supports around 50 lights, but do not prematurely optimize

Important:

Do not implement lighting before basic token LoS works.

# RENDERING LAYERS

Use explicit PixiJS containers/layers.

Suggested order:

1. background
2. grid
3. floors
4. map objects
5. walls
6. doors
7. lights
8. tokens
9. vision/fog overlay
10. editor previews
11. selection/debug overlays

Do not scatter objects randomly across the PixiJS stage.

Create a clear scene hierarchy.

# EDITOR TOOLS

Use a tool-state model.

Example:

type EditorTool =
\| "select"
\| "floor"
\| "erase-floor"
\| "wall"
\| "door"
\| "light"
\| "token"

Each tool should have isolated pointer behavior.

Avoid one giant pointer event handler containing all editor logic.

Prefer a tool controller pattern or similarly clean separation.

# UNDO/REDO

Do NOT implement full undo/redo immediately.

However, avoid architecture that makes undo/redo impossible.

Prefer explicit scene operations such as:

- addFloorTile
- removeFloorTile
- addWall
- updateWall
- removeWall
- addDoor
- updateDoor
- removeDoor
- addLight
- addToken
- moveToken

Do not allow arbitrary mutation from everywhere in the application.

# PERFORMANCE PRINCIPLES

Long-term requirement:

The VTT should work on low-end laptops.

For Prototype 0:

- do not create one Pixi object per grid line for an infinite world
- render only visible grid area
- avoid unnecessary React rerenders
- do not mirror high-frequency pointer movement through React state
- keep transient drag/preview state close to the renderer/editor controller
- avoid recalculating LoS when nothing relevant changed
- do not optimize blindly
- profile before introducing complex optimization

# CODE ORGANIZATION

Use a structure approximately like:

src/
app/
App.tsx

vtt/
engine/
VttEngine.ts
Camera.ts
CoordinateSystem.ts

```
scene/
  Scene.ts
  SceneTypes.ts
  SceneStore.ts
  SceneOperations.ts

renderer/
  SceneRenderer.ts
  GridRenderer.ts
  FloorRenderer.ts
  WallRenderer.ts
  DoorRenderer.ts
  LightRenderer.ts
  TokenRenderer.ts
  VisionRenderer.ts

editor/
  EditorController.ts
  EditorTool.ts
  tools/
    SelectTool.ts
    FloorTool.ts
    EraseFloorTool.ts
    WallTool.ts
    DoorTool.ts
    LightTool.ts
    TokenTool.ts

geometry/
  intersections.ts
  segments.ts
  projection.ts
  visibilityPolygon.ts
  collision.ts

systems/
  VisionSystem.ts
  LightingSystem.ts
  MovementSystem.ts
  DoorSystem.ts
```

ui/
Toolbar.tsx
PropertiesPanel.tsx

You may adjust this if necessary, but preserve separation of concerns.

Do not create a massive single-file implementation.

# TESTING

Geometry code is high risk.

Add unit tests for pure geometry functions, especially:

- segment intersection
- point projection onto wall
- nearest wall lookup
- door opening interval
- effective wall segment generation
- ray/segment intersection
- visibility polygon edge cases

Test cases should include:

- simple square room
- door in middle of wall
- door near wall endpoint
- open door
- closed door
- moved door
- deleted door
- two doors on one wall if supported
- token exactly near wall
- rays near corners

# DEVELOPMENT ORDER

Follow this order strictly unless a blocker requires adjustment.

MILESTONE 0

- initialize project
- React shell
- PixiJS canvas
- camera
- pan
- zoom
- infinite-feeling grid

STOP and verify.

MILESTONE 1

- scene data model
- floor painting
- floor erasing

STOP and verify.

MILESTONE 2

- horizontal/vertical wall drawing
- wall rendering
- wall selection if needed for debugging

STOP and verify.

MILESTONE 3

- token placement
- token dragging
- basic wall movement collision

STOP and verify.

MILESTONE 4

- token LoS
- visibility polygon
- walls block vision

STOP and verify.

MILESTONE 5

- door placement onto walls
- open/closed state
- effective blocking segments
- open door changes LoS
- closed door blocks LoS
- movement through open door
- movement blocked by closed door
- move door along wall
- delete door

STOP and verify.

MILESTONE 6

- point lights
- radius
- colored light
- wall occlusion
- door state affects light propagation

STOP and verify.

MILESTONE 7

- usability cleanup
- debug overlays
- basic properties panel
- performance profiling
- build several test rooms manually

# WORKING STYLE

You are implementing this with me interactively.

Rules:

1. Inspect the repository before making assumptions.
2. Inspect package.json and installed dependency versions.
3. Do not invent files that already exist without checking.
4. Do not rewrite working code unnecessarily.
5. Make small coherent changes.
6. After each milestone, run:
   - typecheck
   - tests
   - build
7. Fix errors before continuing.
8. Do not silently ignore warnings that indicate architectural problems.
9. Explain major architectural decisions briefly.
10. Prefer working code over theoretical abstraction.
11. Do not add dependencies without explaining why they are needed.
12. Do not implement future features early.
13. Do not replace PixiJS with another renderer.
14. Do not replace TypeScript/React/Vite stack.
15. Do not add a backend.
16. Do not add authentication.
17. Do not add multiplayer yet.
18. Do not add AI features yet.

# FIRST TASK

Start with MILESTONE 0 only.

Do not proceed to floor painting yet.

Your immediate task is:

1. Inspect the current repository.
2. If the repository is empty, initialize a Vite + React + TypeScript project.
3. Install and configure PixiJS.
4. Create a full-browser map viewport.
5. Render an infinite-feeling square grid.
6. Add mouse pan.
7. Add wheel zoom centered around the mouse cursor.
8. Implement correct screen/world coordinate conversion.
9. Keep React responsible for UI shell only.
10. Keep PixiJS responsible for viewport rendering.
11. Add a tiny debug display showing:
    - camera x
    - camera y
    - zoom
    - mouse world x
    - mouse world y
12. Run typecheck and production build.
13. Fix all errors.
14. Stop after Milestone 0.
15. Report:
    - files created
    - files modified
    - architecture used
    - commands to run locally
    - known limitations

Do not continue to Milestone 1 until I explicitly approve it.

Begin now.
