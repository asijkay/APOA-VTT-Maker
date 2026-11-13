import { describe, it, expect } from 'vitest';
import { findNearestWall, projectPointOnWall, getEffectiveVisionSegments, getEffectiveMovementSegments } from '@/vtt/geometry/doorGeometry';
import type { Wall, Door } from '@/vtt/scene/SceneTypes';

describe('Door Geometry', () => {
  it('findNearestWall finds closest wall within distance', () => {
    const walls: Wall[] = [
      { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0, elevation: 0, blocksVision: true, blocksMovement: true },
      { id: 'w2', x1: 200, y1: 0, x2: 300, y2: 0, elevation: 0, blocksVision: true, blocksMovement: true },
    ];
    
    const result = findNearestWall(50, 10, walls, 50);
    expect(result).not.toBeNull();
    expect(result!.wall.id).toBe('w1');
  });

  it('findNearestWall returns null when no wall within distance', () => {
    const walls: Wall[] = [
      { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0, elevation: 0, blocksVision: true, blocksMovement: true },
    ];
    
    const result = findNearestWall(500, 500, walls, 50);
    expect(result).toBeNull();
  });

  it('projectPointOnWall projects point onto wall segment', () => {
    const wall: Wall = {
      id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0,
      elevation: 0, blocksVision: true, blocksMovement: true,
    };
    
    const result = projectPointOnWall(50, 10, wall);
    expect(result).not.toBeNull();
    expect(result!.projectedPoint).toEqual({ x: 50, y: 0 });
    expect(result!.position).toBe(0.5);
  });

  it('getEffectiveVisionSegments returns full wall with no doors', () => {
    const wall: Wall = {
      id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0,
      elevation: 0, blocksVision: true, blocksMovement: true,
    };
    
    const segments = getEffectiveVisionSegments(wall, []);
    expect(segments).toHaveLength(1);
    expect(segments[0].p1).toEqual({ x: 0, y: 0 });
    expect(segments[0].p2).toEqual({ x: 100, y: 0 });
  });

  it('getEffectiveVisionSegments creates gap for open door', () => {
    const wall: Wall = {
      id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0,
      elevation: 0, blocksVision: true, blocksMovement: true,
    };
    
    const doors: Door[] = [
      { id: 'd1', wallId: 'w1', position: 0.5, width: 20, state: 'open', locked: false, hidden: false, swingDirection: 1 },
    ];
    
    const segments = getEffectiveVisionSegments(wall, doors);
    expect(segments).toHaveLength(2);
    
    // Should have segments before and after the door
    const totalLength = segments.reduce((sum, seg) => {
      return sum + Math.sqrt((seg.p2.x - seg.p1.x) ** 2 + (seg.p2.y - seg.p1.y) ** 2);
    }, 0);
    
    expect(totalLength).toBeCloseTo(80, 1); // 100 - 20 (door width)
  });

  it('getEffectiveVisionSegments ignores closed doors', () => {
    const wall: Wall = {
      id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0,
      elevation: 0, blocksVision: true, blocksMovement: true,
    };
    
    const doors: Door[] = [
      { id: 'd1', wallId: 'w1', position: 0.5, width: 20, state: 'closed', locked: false, hidden: false, swingDirection: 1 },
    ];
    
    const segments = getEffectiveVisionSegments(wall, doors);
    expect(segments).toHaveLength(1);
    expect(segments[0].p1).toEqual({ x: 0, y: 0 });
    expect(segments[0].p2).toEqual({ x: 100, y: 0 });
  });

  it('getEffectiveMovementSegments creates gap for open door', () => {
    const wall: Wall = {
      id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0,
      elevation: 0, blocksVision: true, blocksMovement: true,
    };
    
    const doors: Door[] = [
      { id: 'd1', wallId: 'w1', position: 0.5, width: 20, state: 'open', locked: false, hidden: false, swingDirection: 1 },
    ];
    
    const segments = getEffectiveMovementSegments(wall, doors);
    expect(segments).toHaveLength(2);
    
    const totalLength = segments.reduce((sum, seg) => {
      return sum + Math.sqrt((seg.p2.x - seg.p1.x) ** 2 + (seg.p2.y - seg.p1.y) ** 2);
    }, 0);
    
    expect(totalLength).toBeCloseTo(80, 1); // 100 - 20 (door width)
  });

  it('getEffectiveMovementSegments ignores closed doors', () => {
    const wall: Wall = {
      id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0,
      elevation: 0, blocksVision: true, blocksMovement: true,
    };
    
    const doors: Door[] = [
      { id: 'd1', wallId: 'w1', position: 0.5, width: 20, state: 'closed', locked: false, hidden: false, swingDirection: 1 },
    ];
    
    const segments = getEffectiveMovementSegments(wall, doors);
    expect(segments).toHaveLength(1);
    expect(segments[0].p1).toEqual({ x: 0, y: 0 });
    expect(segments[0].p2).toEqual({ x: 100, y: 0 });
  });
});