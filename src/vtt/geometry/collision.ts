import type { Scene } from '../scene/SceneTypes';
import { getEffectiveMovementSegments } from './doorGeometry';
import type { Point2 } from './segments';

export function resolveCircleAgainstSegment(
  cx: number, cy: number, r: number,
  x1: number, y1: number, x2: number, y2: number
): { dx: number; dy: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;
  const cxDx = cx - nearestX;
  const cyDy = cy - nearestY;
  const distSq = cxDx * cxDx + cyDy * cyDy;

  if (distSq >= r * r) return { dx: 0, dy: 0 };

  // Collision
  if (distSq < 1e-6) {
    // Circle center exactly on the segment. Push perpendicular.
    const nx = -dy;
    const ny = dx;
    const nLen = Math.sqrt(nx * nx + ny * ny);
    if (nLen === 0) return { dx: r, dy: 0 }; // Degenerate segment
    return { dx: (nx / nLen) * r, dy: (ny / nLen) * r };
  }

  const dist = Math.sqrt(distSq);
  const overlap = r - dist + 1e-4; // small epsilon
  return { dx: (cxDx / dist) * overlap, dy: (cyDy / dist) * overlap };
}

type Seg = { p1: Point2; p2: Point2 };

/** Movement-blocking segments (walls + closed doors), optionally limited to one elevation. */
export function collectMovementSegments(scene: Scene, elevation?: number): Seg[] {
  const segments: Seg[] = [];
  for (const w of scene.walls) {
    if (!w.blocksMovement) continue;
    if (elevation !== undefined && w.elevation !== elevation) continue;
    segments.push(...getEffectiveMovementSegments(w, scene.doors));
  }
  return segments;
}

function resolveCircleAgainstSegments(
  cx: number, cy: number, r: number, segments: Seg[], passes: number,
): { x: number; y: number } {
  let x = cx;
  let y = cy;
  for (let pass = 0; pass < passes; pass += 1) {
    const deltas: { dx: number; dy: number; mag: number }[] = [];
    for (const seg of segments) {
      const delta = resolveCircleAgainstSegment(x, y, r, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
      const mag = Math.hypot(delta.dx, delta.dy);
      if (mag < 1e-6) continue;
      deltas.push({ dx: delta.dx, dy: delta.dy, mag });
    }
    if (deltas.length === 0) break;
    deltas.sort((a, b) => b.mag - a.mag);
    for (const d of deltas) {
      x += d.dx;
      y += d.dy;
    }
  }
  return { x, y };
}

/**
 * Resolves circle against all wall segments in the scene. Applies repeated
 * resolution passes (default 12 passes maximum) to handle multi-wall corner
 * cases and returns the final clamped circle position (cx,cy) that does not
 * overlap any movement-blocking wall. Iteration stops early once a full pass
 * produces no movement.
 */
export function resolveCircleAgainstSceneWalls(
  cx: number, cy: number, r: number, scene: Scene,
  opts: { elevation?: number; passes?: number } = {}
): { x: number; y: number } {
  return resolveCircleAgainstSegments(cx, cy, r, collectMovementSegments(scene, opts.elevation), opts.passes ?? 12);
}

/**
 * Moves a circle from `from` towards `to` in sub-steps no larger than half its
 * radius, resolving against walls at every step, so it can't tunnel through a
 * thin wall however far the requested move is. The segment list is built once.
 * Returns where the circle actually ends up (it slides along walls it hits).
 *
 * Work is bounded by truncating the *distance* (never by enlarging the step, which
 * would reintroduce tunnelling): a move longer than `maxDistance` stops short.
 */
export function moveCircleSwept(
  from: Point2, to: Point2, r: number, scene: Scene,
  opts: { elevation?: number; passes?: number; maxDistance?: number } = {},
): { x: number; y: number } {
  const segments = collectMovementSegments(scene, opts.elevation);
  const passes = opts.passes ?? 12;
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  let dist = Math.hypot(dx, dy);
  const maxDistance = opts.maxDistance ?? 20_000;
  if (!Number.isFinite(dist)) return resolveCircleAgainstSegments(from.x, from.y, r, segments, passes);
  if (dist > maxDistance) {
    dx *= maxDistance / dist;
    dy *= maxDistance / dist;
    dist = maxDistance;
  }
  const stepSize = Math.max(5, r / 2);
  const steps = Math.ceil(dist / stepSize);
  if (steps <= 0) return resolveCircleAgainstSegments(from.x, from.y, r, segments, passes);

  let x = from.x;
  let y = from.y;
  for (let i = 0; i < steps; i += 1) {
    const r2 = resolveCircleAgainstSegments(x + dx / steps, y + dy / steps, r, segments, passes);
    x = r2.x;
    y = r2.y;
  }
  return { x, y };
}
