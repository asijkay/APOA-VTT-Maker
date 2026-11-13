# systems

## Overview
Derived-state and rule logic over a `Scene`: vision polygons, lighting polygons, fog-of-war memory, and door operations. Built on `../geometry`.

## Interface
- `VisionSystem.ts`: type `VisionResult {tokenId, polygon}`; `computeAllVision(scene)`, `computeTokenVision(token, scene)`.
- `LightingSystem.ts`: type `LightResult {lightId, polygon, color, radius}`; `computeAllLighting(scene)`.
- `FogSystem.ts`: class `FogSystem` with `update(visionResults, gridSize)`, `mergeRevealed(cells)`, `getRevealedCells()`, `getCurrentlyVisibleCells()`, `reset()`.
- `DoorSystem.ts`: class `DoorSystem` static `placeDoor`, `toggleDoor`, `moveDoor`, `canPlaceDoorAt`.

## Invariants
- [VisionSystem.ts:computeAllVision] Tokens with `visionRadius <= 0` produce no result.
- [LightingSystem.ts:computeAllLighting] Only lights with `enabled` and `radius > 0` are computed; walls with `blocksVision` false do not block light; windows pass light.
- [FogSystem.ts:revealedCells] Revealed cells only grow until `reset()`; `currentlyVisibleCells` is rebuilt each `update`.
- [DoorSystem.ts:moveDoor] Rejects positions outside 0..1 and returns false.
- [DoorSystem.ts:placeDoor] Only places on a wall within 30 units of the point; new doors start `closed`, unlocked, not hidden.

## Side Effects
- [DoorSystem.ts:toggleDoor, moveDoor] Mutate the passed `Door` object in place.
- [FogSystem.ts] Holds mutable in-memory sets.
- Vision and lighting functions are pure.

## Verification
- Run: `npm test`
