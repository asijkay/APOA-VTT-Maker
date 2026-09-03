import type { Scene, Door } from '../scene/SceneTypes';
import { findNearestWall, projectPointOnWall } from '../geometry/doorGeometry';

/**
 * Door system for managing door operations.
 */
export class DoorSystem {
  /**
   * Attempts to place a door on the nearest wall to the given point.
   * Returns the created door or null if no valid wall is found.
   */
  static placeDoor(
    scene: Scene,
    x: number,
    y: number,
    width: number = 20,
  ): Door | null {
    const nearest = findNearestWall(x, y, scene.walls, 30);
    if (!nearest) return null;

    const wall = nearest.wall;
    const result = projectPointOnWall(x, y, wall);
    if (!result) return null;

    const door: Door = {
      id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      wallId: wall.id,
      position: result.position,
      width,
      state: 'closed',
      locked: false,
      hidden: false,
    };

    return door;
  }

  /**
   * Toggles a door's open/closed state.
   */
  static toggleDoor(door: Door): void {
    door.state = door.state === 'open' ? 'closed' : 'open';
  }

  /**
   * Moves a door along its parent wall to a new position.
   */
  static moveDoor(door: Door, newPosition: number): boolean {
    if (newPosition < 0 || newPosition > 1) return false;
    door.position = newPosition;
    return true;
  }

  /**
   * Validates that a door can be placed at the given position on its wall.
   * Checks for overlap with other doors on the same wall.
   */
  static canPlaceDoorAt(
    scene: Scene,
    wallId: string,
    position: number,
    width: number,
    excludeDoorId?: string,
  ): boolean {
    const wallDoors = scene.doors.filter(d => 
      d.wallId === wallId && d.id !== excludeDoorId
    );

    const halfWidth = width / 2;
    const minPos = position - halfWidth;
    const maxPos = position + halfWidth;

    for (const other of wallDoors) {
      const otherHalfWidth = other.width / 2;
      const otherMin = other.position - otherHalfWidth;
      const otherMax = other.position + otherHalfWidth;

      // Check for overlap
      if (minPos < otherMax && maxPos > otherMin) {
        return false;
      }
    }

    return true;
  }
}