import type { Scene, Wall } from '../scene/SceneTypes';
import { getEffectiveMovementSegments } from './doorGeometry';

export type AARect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/**
 * Converts scene walls (horizontal/vertical only, thickness=wu) to a list of
 * axis-aligned filled rectangles matching the movement blocking geometry.
 * Only walls with blocksMovement=true are included. Elevation filtering optional.
 * Considers door states - open doors create gaps in blocking.
 */
export function wallsToMovementRects(
  scene: Scene,
  opts: { elevation?: number; wallThickness?: number } = {},
): AARect[] {
  const T = opts.wallThickness ?? 4;
  const out: AARect[] = [];
  for (const w of scene.walls) {
    if (!w.blocksMovement) continue;
    if (opts.elevation !== undefined && w.elevation !== opts.elevation) continue;
    
    // Get effective movement segments considering doors
    const segments = getEffectiveMovementSegments(w, scene.doors);
    
    for (const seg of segments) {
      const isH = seg.p1.y === seg.p2.y;
      const isV = seg.p1.x === seg.p2.x;
      if (!isH && !isV) continue;
      if (isH) {
        out.push({ x1: seg.p1.x, y1: seg.p1.y - T / 2, x2: seg.p2.x, y2: seg.p1.y + T / 2 });
      } else {
        out.push({ x1: seg.p1.x - T / 2, y1: seg.p1.y, x2: seg.p1.x + T / 2, y2: seg.p2.y });
      }
    }
  }
  return out;
}

/**
 * Returns true if a circle (cx,cy,r) overlaps (or touches) axis-aligned rect.
 * Chebyshev + corner distance check.
 */
export function circleOverlapsRect(cx: number, cy: number, r: number, rect: AARect): boolean {
  const nearestX = Math.max(rect.x1, Math.min(cx, rect.x2));
  const nearestY = Math.max(rect.y1, Math.min(cy, rect.y2));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r * r;
}

/**
 * For a single overlapping circle/rect pair, returns a minimal translation
 * vector (dx,dy) to push the circle fully out of the rect. If not overlapping,
 * returns (0,0). Prefers the smallest single-axis push.
 */
export function resolveCircleAgainstRect(
  cx: number,
  cy: number,
  r: number,
  rect: AARect,
): { dx: number; dy: number } {
  if (!circleOverlapsRect(cx, cy, r, rect)) return { dx: 0, dy: 0 };
  // nearest point on rect to circle center (if center outside rect, nearest is edge/corner)
  const nearestX = Math.max(rect.x1, Math.min(cx, rect.x2));
  const nearestY = Math.max(rect.y1, Math.min(cy, rect.y2));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const distSq = dx * dx + dy * dy;
  // if circle center INSIDE rect (distSq = 0 or very small): push out along smallest axis overlap
  if (distSq < 1e-6) {
    const overL = (cx + r) - rect.x1 + 1e-6; // push right by this to escape left edge, plus epsilon
    const overR = rect.x2 - (cx - r) + 1e-6; // push left by this
    const overT = (cy + r) - rect.y1 + 1e-6;
    const overB = rect.y2 - (cy - r) + 1e-6;
    const minOver = Math.min(overL, overR, overT, overB);
    if (minOver === overL) return { dx: -overL, dy: 0 };
    if (minOver === overR) return { dx: overR, dy: 0 };
    if (minOver === overT) return { dx: 0, dy: -overT };
    return { dx: 0, dy: overB };
  }
  // center outside: push outward along nearest-point direction by (r - dist + epsilon)
  const dist = Math.sqrt(distSq);
  const overlap = r - dist + 1e-6; // positive since overlapping, plus tiny epsilon to avoid touching
  const nx = dx / dist;
  const ny = dy / dist;
  return { dx: nx * overlap, dy: ny * overlap };
}

/**
 * Resolves circle against all wall rectangles in the scene. Applies repeated
 * resolution passes (default 12 passes maximum) to handle multi-wall corner
 * cases and returns the final clamped circle position (cx,cy) that does not
 * overlap any movement-blocking wall. Iteration stops early once a full pass
 * produces no movement.
 */
export function resolveCircleAgainstSceneWalls(
  cx: number,
  cy: number,
  r: number,
  scene: Scene,
  opts: { elevation?: number; wallThickness?: number; passes?: number } = {},
): { x: number; y: number } {
  const rects = wallsToMovementRects(scene, opts);
  const passes = opts.passes ?? 12;
  let x = cx;
  let y = cy;
  for (let pass = 0; pass < passes; pass += 1) {
    let moved = false;
    const deltas: { dx: number; dy: number; mag: number }[] = [];
    for (const rect of rects) {
      const delta = resolveCircleAgainstRect(x, y, r, rect);
      const mag = Math.hypot(delta.dx, delta.dy);
      if (mag < 1e-6) continue;
      deltas.push({ dx: delta.dx, dy: delta.dy, mag });
    }
    if (deltas.length === 0) break;
    deltas.sort((a, b) => b.mag - a.mag);
    for (const d of deltas) {
      x += d.dx;
      y += d.dy;
      moved = true;
    }
    if (!moved) break;
  }
  return { x, y };
}

// Helper: expose per-wall-rect derived from a single Wall (used by tests directly)
export function wallToRect(w: Wall, wallThickness = 4): AARect | null {
  const isH = w.y1 === w.y2;
  const isV = w.x1 === w.x2;
  if (!isH && !isV) return null;
  const T = wallThickness;
  if (isH) return { x1: w.x1, y1: w.y1 - T / 2, x2: w.x2, y2: w.y1 + T / 2 };
  return { x1: w.x1 - T / 2, y1: w.y1, x2: w.x1 + T / 2, y2: w.y2 };
}
