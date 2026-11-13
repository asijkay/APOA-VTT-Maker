import type { Door, FloorTile, Light, MapImage, Scene, Token, Wall, Window as SceneWindow } from '../scene/SceneTypes';
import { cellKey, cellsInPolygon, pointInPolygon } from '../geometry/cells';
import type { Point2 } from '../geometry/segments';
import { computeTokenVision } from '../systems/VisionSystem';
import type { Viewer } from './protocol';

/** What one player has explored. Lives on the host, per player. */
export type ViewerMemory = {
  revealed: Set<string>;
  /** Cells revealed since the caller last drained this list (to be sent to that player). */
  added: string[];
};

export function createMemory(revealed: Set<string> = new Set()): ViewerMemory {
  return { revealed, added: [] };
}

function distToSegment(px: number, py: number, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/**
 * The scene as one viewer is allowed to know it. Runs on the host, so what is
 * filtered out never reaches the player's browser at all.
 *
 * GM: everything. Player:
 *  - tokens: own tokens, plus others only while inside the vision of an owned token
 *    (hidden tokens only if owned). Other players' ownerId is stripped.
 *  - doors: secret doors removed
 *  - map layout (walls, floors, windows, doors, lights, images): only what lies within
 *    vision range of an owned token (so the client's own line-of-sight maths is exact),
 *    or in a cell this player has explored before ("fog memory").
 *
 * `memory` is updated in place with newly explored cells.
 *
 * Residual limits: a map image is sent whole once any part of it is seen, and walls are
 * judged by sampled points, so a long wall is sent if any sampled point is explored.
 */
export function filterSceneForViewer(scene: Scene, viewer: Viewer, memory: ViewerMemory = createMemory()): Scene {
  if (viewer.isGM) return scene;

  const g = scene.gridSize;
  const owned = viewer.playerId ? scene.tokens.filter((t) => t.ownerId === viewer.playerId) : [];
  const seeing = owned.filter((t) => t.visionRadius > 0);
  const polygons = seeing.map((t) => computeTokenVision(t, scene));

  for (const poly of polygons) {
    for (const key of cellsInPolygon(poly, g)) {
      if (!memory.revealed.has(key)) {
        memory.revealed.add(key);
        memory.added.push(key);
      }
    }
  }

  const explored = (x: number, y: number): boolean => {
    // Check the cells on every side of the point, so something lying on a cell edge counts.
    const e = 1;
    for (const dx of [-e, e]) {
      for (const dy of [-e, e]) {
        if (memory.revealed.has(cellKey(Math.floor((x + dx) / g), Math.floor((y + dy) / g)))) return true;
      }
    }
    return false;
  };
  /** Within `pad` of the sight range of any seeing token. */
  const nearSight = (x: number, y: number, pad: number): boolean =>
    seeing.some((t) => Math.hypot(x - t.x, y - t.y) <= t.visionRadius + pad);

  // ── tokens ──
  const inVision = (t: Token): boolean => {
    const cx = (Math.floor(t.x / g) + 0.5) * g;
    const cy = (Math.floor(t.y / g) + 0.5) * g;
    return polygons.some((p) => pointInPolygon(t.x, t.y, p) || pointInPolygon(cx, cy, p));
  };
  const tokens: Token[] = [];
  for (const t of scene.tokens) {
    if (viewer.playerId && t.ownerId === viewer.playerId) { tokens.push(t); continue; }
    if (t.hidden || !inVision(t)) continue;
    const { ownerId: _owner, ...rest } = t;
    void _owner;
    tokens.push(rest);
  }

  // ── walls (and what hangs off them) ──
  const wallVisible = (w: Wall): boolean => {
    const a = { x: w.x1, y: w.y1 };
    const b = { x: w.x2, y: w.y2 };
    // Anything within sight range (+ a cell of slack) must be present for client line-of-sight to be exact.
    if (seeing.some((t) => distToSegment(t.x, t.y, a, b) <= t.visionRadius + g)) return true;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len / (g / 2)));
    for (let i = 0; i <= n; i++) {
      if (explored(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n)) return true;
    }
    return false;
  };
  const walls: Wall[] = scene.walls.filter(wallVisible);
  const wallIds = new Set(walls.map((w) => w.id));
  const doors: Door[] = scene.doors.filter((d) => !d.hidden && wallIds.has(d.wallId));
  const windows: SceneWindow[] = scene.windows.filter((w) => wallIds.has(w.wallId));

  // ── floors, lights, images ──
  const floors: FloorTile[] = scene.floors.filter((f) => memory.revealed.has(cellKey(f.gridX, f.gridY)));
  const lights: Light[] = scene.lights.filter(
    (l) => nearSight(l.x, l.y, l.radius) || explored(l.x, l.y),
  );
  const images: MapImage[] = scene.images.filter((img) => {
    const hx = img.width / 2;
    const hy = img.height / 2;
    if (seeing.some((t) => Math.abs(t.x - img.x) <= hx + t.visionRadius && Math.abs(t.y - img.y) <= hy + t.visionRadius)) {
      return true;
    }
    for (const key of memory.revealed) {
      const [gx, gy] = key.split(',').map(Number);
      const cx = (gx + 0.5) * g;
      const cy = (gy + 0.5) * g;
      if (Math.abs(cx - img.x) <= hx && Math.abs(cy - img.y) <= hy) return true;
    }
    return false;
  });

  return { ...scene, tokens, walls, doors, windows, floors, lights, images };
}
