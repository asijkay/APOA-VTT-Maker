import { describe, it, expect } from 'vitest';
import { computeVisibilityPolygon } from '@/vtt/geometry/visibilityPolygon';
import type { Point2, Segment } from '@/vtt/geometry/segments';

describe('Visibility Polygon', () => {
  it('computes visibility with no obstacles', () => {
    const origin: Point2 = { x: 0, y: 0 };
    const segments: Segment[] = [];
    const polygon = computeVisibilityPolygon(origin, segments, 100);
    
    // Should return a polygon approximating a circle
    expect(polygon.length).toBeGreaterThan(0);
    expect(polygon.length).toBeLessThan(50); // Shouldn't be excessive
    
    // All points should be at roughly the right distance
    for (const p of polygon) {
      const dist = Math.sqrt((p.x - origin.x) ** 2 + (p.y - origin.y) ** 2);
      expect(dist).toBeCloseTo(100, 1);
    }
  });

  it('computes visibility with a single wall', () => {
    const origin: Point2 = { x: 0, y: 0 };
    const segments: Segment[] = [
      { p1: { x: 50, y: -50 }, p2: { x: 50, y: 50 } },
    ];
    const polygon = computeVisibilityPolygon(origin, segments, 100);
    
    expect(polygon.length).toBeGreaterThan(0);
    
    // Check that points behind the wall are shadowed
    const pointsBehindWall = polygon.filter(p => p.x > 50 && Math.abs(p.y) < 50);
    expect(pointsBehindWall.length).toBe(0);
  });

  it('computes visibility with a simple room', () => {
    const origin: Point2 = { x: 100, y: 100 };
    const segments: Segment[] = [
      { p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 } },   // top
      { p1: { x: 200, y: 0 }, p2: { x: 200, y: 200 } }, // right
      { p1: { x: 200, y: 200 }, p2: { x: 0, y: 200 } }, // bottom
      { p1: { x: 0, y: 200 }, p2: { x: 0, y: 0 } },     // left
    ];
    const polygon = computeVisibilityPolygon(origin, segments, 1000);
    
    expect(polygon.length).toBeGreaterThan(0);
    
    // All points should be inside the room
    for (const p of polygon) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(200);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(200);
    }
  });
});