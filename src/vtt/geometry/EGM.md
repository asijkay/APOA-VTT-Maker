# geometry

## Overview
Pure 2D math helpers shared by systems, network validation, and tools: segments, grid-cell rasterization, visibility polygons, wall/door/window occlusion, and circle-vs-wall collision. No I/O, no state.

## Interface
- `segments.ts`: types `Point2`, `Segment`; `distSq`, `dist`, `angle`, `normalizeAngle`, `projectPointOnSegment`, `segmentIntersection`, `raySegmentIntersection`.
- `cells.ts`: `cellKey(gx, gy)`, `pointInPolygon`, `cellsInPolygon(polygon, gridSize)` (returns `"gx,gy"` keys).
- `visibilityPolygon.ts`: `computeVisibilityPolygon(origin, segments, radius)`, `wallsToVisionSegments(scene)`.
- `doorGeometry.ts`: `findNearestWall`, `projectPointOnWall`, `getEffectiveVisionSegments(wall, doors, windows)`, `getEffectiveMovementSegments`.
- `collision.ts`: `resolveCircleAgainstSegment`, `collectMovementSegments(scene, elevation?)`, `resolveCircleAgainstSceneWalls`, `moveCircleSwept(from, to, r, scene, opts)`.

## Invariants
- [doorGeometry.ts:getEffectiveVisionSegments] Open doors create gaps for vision; windows always create vision gaps; walls with `blocksVision` false yield no segments.
- [collision.ts:moveCircleSwept] Moves are sub-stepped (step <= max(5, r/2)) so circles cannot tunnel through thin walls; over-long moves are truncated by distance (default `maxDistance` 20000), never by enlarging the step.
- Depends only on `scene/SceneTypes` types; no imports from renderer, network, or editor.

## Side Effects
- None (pure functions).

## Verification
- Run: `npm test`
