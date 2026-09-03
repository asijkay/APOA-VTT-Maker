import type { Scene, Token } from '../scene/SceneTypes';
import { computeVisibilityPolygon, wallsToVisionSegments } from '../geometry/visibilityPolygon';
import type { Point2 } from '../geometry/segments';

export type VisionResult = {
  tokenId: string;
  polygon: Point2[];
};

/**
 * Computes visibility polygons for all tokens in the scene.
 * Only includes tokens with visionRadius > 0.
 */
export function computeAllVision(scene: Scene): VisionResult[] {
  const results: VisionResult[] = [];
  const visionSegments = wallsToVisionSegments(scene);

  for (const token of scene.tokens) {
    if (token.visionRadius <= 0) continue;

    const origin: Point2 = { x: token.x, y: token.y };
    const polygon = computeVisibilityPolygon(origin, visionSegments, token.visionRadius);

    results.push({
      tokenId: token.id,
      polygon,
    });
  }

  return results;
}

/**
 * Computes visibility for a single token.
 */
export function computeTokenVision(token: Token, scene: Scene): Point2[] {
  if (token.visionRadius <= 0) return [];

  const origin: Point2 = { x: token.x, y: token.y };
  const visionSegments = wallsToVisionSegments(scene);

  return computeVisibilityPolygon(origin, visionSegments, token.visionRadius);
}