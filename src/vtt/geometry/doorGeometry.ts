import type { Wall, Door } from '../scene/SceneTypes';
import type { Segment } from './segments';
import { dist } from './segments';

/**
 * Finds the nearest wall to a point, within a maximum distance.
 * Returns the wall and the projected point on the wall.
 */
export function findNearestWall(
  x: number,
  y: number,
  walls: Wall[],
  maxDistance: number = 20,
): { wall: Wall; projectedPoint: { x: number; y: number } } | null {
  let nearest: { wall: Wall; projectedPoint: { x: number; y: number }; distance: number } | null = null;

  for (const wall of walls) {
    const result = projectPointOnWall(x, y, wall);
    if (!result) continue;

    const d = dist({ x, y }, result.projectedPoint);
    if (d > maxDistance) continue;

    if (!nearest || d < nearest.distance) {
      nearest = { wall, projectedPoint: result.projectedPoint, distance: d };
    }
  }

  return nearest;
}

/**
 * Projects a point onto a wall segment.
 * Returns the projected point and the normalized position along the wall (0-1).
 */
export function projectPointOnWall(
  x: number,
  y: number,
  wall: Wall,
): { projectedPoint: { x: number; y: number }; position: number } | null {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return null;

  let t = ((x - wall.x1) * dx + (y - wall.y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    projectedPoint: {
      x: wall.x1 + t * dx,
      y: wall.y1 + t * dy,
    },
    position: t,
  };
}

/**
 * Computes the effective vision-blocking segments for a wall, considering attached doors.
 * Closed doors create gaps in the wall's blocking segment.
 * Open doors restore the wall's blocking in that area.
 */
export function getEffectiveVisionSegments(
  wall: Wall,
  doors: Door[],
): Segment[] {
  if (!wall.blocksVision) return [];

  const wallDoors = doors.filter(d => d.wallId === wall.id);
  if (wallDoors.length === 0) {
    return [{
      p1: { x: wall.x1, y: wall.y1 },
      p2: { x: wall.x2, y: wall.y2 },
    }];
  }

  const sortedDoors = [...wallDoors].sort((a, b) => a.position - b.position);
  const segments: Segment[] = [];
  let lastPos = 0;
  
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const wallLen = Math.sqrt(dx * dx + dy * dy);

  for (const door of sortedDoors) {
    // Open doors create gaps in vision blocking
    if (door.state === 'open') {
      const normWidth = wallLen > 0 ? door.width / wallLen : 0;
      const doorStart = Math.max(0, door.position - normWidth / 2);
      const doorEnd = Math.min(1, door.position + normWidth / 2);

      if (doorStart > lastPos) {
        segments.push(createWallSegment(wall, lastPos, doorStart));
      }
      lastPos = doorEnd;
    }
  }

  if (lastPos < 1) {
    segments.push(createWallSegment(wall, lastPos, 1));
  }

  return segments;
}

/**
 * Computes the effective movement-blocking segments for a wall, considering attached doors.
 * Closed doors block movement (like walls).
 * Open doors allow movement (create gaps).
 */
export function getEffectiveMovementSegments(
  wall: Wall,
  doors: Door[],
): Segment[] {
  if (!wall.blocksMovement) return [];

  const wallDoors = doors.filter(d => d.wallId === wall.id);
  if (wallDoors.length === 0) {
    return [{
      p1: { x: wall.x1, y: wall.y1 },
      p2: { x: wall.x2, y: wall.y2 },
    }];
  }

  const sortedDoors = [...wallDoors].sort((a, b) => a.position - b.position);
  const segments: Segment[] = [];
  let lastPos = 0;

  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const wallLen = Math.sqrt(dx * dx + dy * dy);

  for (const door of sortedDoors) {
    // Open doors create gaps in movement blocking
    if (door.state === 'open') {
      const normWidth = wallLen > 0 ? door.width / wallLen : 0;
      const doorStart = Math.max(0, door.position - normWidth / 2);
      const doorEnd = Math.min(1, door.position + normWidth / 2);

      if (doorStart > lastPos) {
        segments.push(createWallSegment(wall, lastPos, doorStart));
      }
      lastPos = doorEnd;
    }
  }

  if (lastPos < 1) {
    segments.push(createWallSegment(wall, lastPos, 1));
  }

  return segments;
}

/**
 * Creates a segment representing a portion of a wall between two normalized positions.
 */
function createWallSegment(wall: Wall, pos1: number, pos2: number): Segment {
  const x1 = wall.x1 + (wall.x2 - wall.x1) * pos1;
  const y1 = wall.y1 + (wall.y2 - wall.y1) * pos1;
  const x2 = wall.x1 + (wall.x2 - wall.x1) * pos2;
  const y2 = wall.y1 + (wall.y2 - wall.y1) * pos2;

  return {
    p1: { x: x1, y: y1 },
    p2: { x: x2, y: y2 },
  };
}