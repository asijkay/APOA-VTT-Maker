import type { Scene } from '../scene/SceneTypes';
import { computeVisibilityPolygon } from '../geometry/visibilityPolygon';
import { getEffectiveVisionSegments } from '../geometry/doorGeometry';
import type { Point2 } from '../geometry/segments';

export type LightResult = {
  lightId: string;
  polygon: Point2[];
  color: string;
  radius: number;
};

/**
 * Computes lighting polygons for all lights in the scene.
 * Only includes lights that are enabled and have radius > 0.
 * Walls and closed doors block light propagation (same as vision).
 */
export function computeAllLighting(scene: Scene): LightResult[] {
  const results: LightResult[] = [];

  for (const light of scene.lights) {
    if (!light.enabled || light.radius <= 0) continue;

    const origin: Point2 = { x: light.x, y: light.y };
    
    // Light occlusion uses the same logic as vision occlusion
    const lightSegments = getLightOcclusionSegments(scene);
    const polygon = computeVisibilityPolygon(origin, lightSegments, light.radius);

    results.push({
      lightId: light.id,
      polygon,
      color: light.color,
      radius: light.radius,
    });
  }

  return results;
}

/**
 * Gets segments that block light propagation.
 * Uses the same logic as vision: walls block light, closed doors block light, open doors allow light.
 */
function getLightOcclusionSegments(scene: Scene) {
  const segments = [];
  
  for (const wall of scene.walls) {
    if (!wall.blocksVision) continue; // Walls that don't block vision also don't block light
    
    // Get effective segments considering doors and windows (windows pass light)
    const wallSegments = getEffectiveVisionSegments(wall, scene.doors, scene.windows);
    segments.push(...wallSegments);
  }
  
  return segments;
}