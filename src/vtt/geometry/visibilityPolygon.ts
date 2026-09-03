import type { Point2, Segment } from './segments';
import { angle, normalizeAngle, raySegmentIntersection } from './segments';
import type { Scene } from '../scene/SceneTypes';
import { getEffectiveVisionSegments } from './doorGeometry';

/**
 * Computes a visibility polygon from an origin point, given a set of segments that block vision.
 * Uses a ray-casting approach with epsilon angles around segment endpoints.
 */
export function computeVisibilityPolygon(
  origin: Point2,
  segments: Segment[],
  maxDistance: number = Infinity,
): Point2[] {
  if (segments.length === 0) {
    // No obstacles: return a circle at max distance
    const points: Point2[] = [];
    const numPoints = 32;
    for (let i = 0; i < numPoints; i++) {
      const a = (2 * Math.PI * i) / numPoints;
      points.push({
        x: origin.x + Math.cos(a) * maxDistance,
        y: origin.y + Math.sin(a) * maxDistance,
      });
    }
    return points;
  }

  // Collect all unique angles from segment endpoints
  const angles = new Set<number>();
  const epsilon = 0.0001; // Small angle to cast rays around corners

  for (const seg of segments) {
    for (const p of [seg.p1, seg.p2]) {
      const baseAngle = normalizeAngle(angle(origin, p));
      angles.add(baseAngle);
      angles.add(normalizeAngle(baseAngle - epsilon));
      angles.add(normalizeAngle(baseAngle + epsilon));
    }
  }

  // Also add cardinal directions to ensure coverage
  for (let i = 0; i < 8; i++) {
    angles.add((2 * Math.PI * i) / 8);
  }

  // Convert to sorted array
  const sortedAngles = Array.from(angles).sort((a, b) => a - b);

  // Cast rays in each direction and find nearest intersection
  const intersectionPoints: { angle: number; point: Point2; distance: number }[] = [];

  for (const a of sortedAngles) {
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    let nearest: { point: Point2; distance: number } | null = null;
    let nearestDist = maxDistance;

    for (const seg of segments) {
      const result = raySegmentIntersection(origin, dir, seg);
      if (result && result.distance < nearestDist && result.distance > 1e-6) {
        nearest = result;
        nearestDist = result.distance;
      }
    }

    if (nearest) {
      intersectionPoints.push({ angle: a, point: nearest.point, distance: nearest.distance });
    } else {
      // No intersection: ray goes to max distance
      intersectionPoints.push({
        angle: a,
        point: {
          x: origin.x + dir.x * maxDistance,
          y: origin.y + dir.y * maxDistance,
        },
        distance: maxDistance,
      });
    }
  }

  // Sort by angle and return points
  intersectionPoints.sort((a, b) => a.angle - b.angle);
  return intersectionPoints.map((ip) => ip.point);
}

/**
 * Converts a set of wall segments into the format needed for visibility computation.
 * Only includes walls that block vision, considering door states.
 */
export function wallsToVisionSegments(scene: Scene): Segment[] {
  const segments: Segment[] = [];
  for (const wall of scene.walls) {
    if (!wall.blocksVision) continue;
    
    // Get effective segments considering doors
    const wallSegments = getEffectiveVisionSegments(wall, scene.doors);
    segments.push(...wallSegments);
  }
  return segments;
}