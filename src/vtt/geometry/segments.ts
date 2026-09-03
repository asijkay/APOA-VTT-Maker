export type Point2 = { x: number; y: number };
export type Segment = { p1: Point2; p2: Point2 };

/**
 * Returns the squared distance between two points.
 */
export function distSq(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Returns the distance between two points.
 */
export function dist(a: Point2, b: Point2): number {
  return Math.sqrt(distSq(a, b));
}

/**
 * Returns the angle (in radians) of a point relative to an origin.
 */
export function angle(origin: Point2, p: Point2): number {
  return Math.atan2(p.y - origin.y, p.x - origin.x);
}

/**
 * Normalizes an angle to the range [0, 2π).
 */
export function normalizeAngle(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a;
}

/**
 * Projects a point onto a line segment, returning the closest point on the segment.
 */
export function projectPointOnSegment(p: Point2, seg: Segment): Point2 {
  const { p1, p2 } = seg;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  
  if (lenSq === 0) return p1;
  
  let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  return {
    x: p1.x + t * dx,
    y: p1.y + t * dy,
  };
}

/**
 * Finds the intersection point of two line segments, if they intersect.
 * Returns null if the segments don't intersect.
 */
export function segmentIntersection(s1: Segment, s2: Segment): Point2 | null {
  const { p1: a, p2: b } = s1;
  const { p1: c, p2: d } = s2;
  
  const denominator = (d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y);
  if (denominator === 0) return null; // Parallel or collinear
  
  const ua = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / denominator;
  const ub = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / denominator;
  
  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;
  
  return {
    x: a.x + ua * (b.x - a.x),
    y: a.y + ua * (b.y - a.y),
  };
}

/**
 * Finds the intersection of a ray (origin + direction) with a segment.
 * Returns the intersection point and distance, or null if no intersection.
 */
export function raySegmentIntersection(
  origin: Point2,
  dir: Point2,
  seg: Segment,
): { point: Point2; distance: number } | null {
  const { p1, p2 } = seg;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  
  const denominator = dir.x * dy - dir.y * dx;
  if (Math.abs(denominator) < 1e-10) return null;
  
  const t = ((p1.x - origin.x) * dy - (p1.y - origin.y) * dx) / denominator;
  const u = ((p1.x - origin.x) * dir.y - (p1.y - origin.y) * dir.x) / denominator;
  
  if (t < 0 || u < 0 || u > 1) return null;
  
  return {
    point: {
      x: origin.x + t * dir.x,
      y: origin.y + t * dir.y,
    },
    distance: t,
  };
}