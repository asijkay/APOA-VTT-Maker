import { describe, it, expect } from 'vitest';
import {
  gridToWorld,
  snapWorldToGrid,
  worldToGrid,
} from '@/vtt/engine/CoordinateSystem';

describe('CoordinateSystem', () => {
  it('worldToGrid floors to the cell containing the point', () => {
    expect(worldToGrid({ x: 0, y: 0 }, 50)).toEqual({ gx: 0, gy: 0 });
    expect(worldToGrid({ x: 49.99, y: -0.01 }, 50)).toEqual({ gx: 0, gy: -1 });
    expect(worldToGrid({ x: -50, y: 120 }, 50)).toEqual({ gx: -1, gy: 2 });
  });

  it('gridToWorld returns the top-left corner of the grid cell', () => {
    expect(gridToWorld(0, 0, 50)).toEqual({ x: 0, y: 0 });
    expect(gridToWorld(-2, 3, 50)).toEqual({ x: -100, y: 150 });
  });

  it('snapWorldToGrid rounds to the nearest grid intersection', () => {
    expect(snapWorldToGrid({ x: 24, y: 26 }, 50)).toEqual({ x: 0, y: 50 });
    expect(snapWorldToGrid({ x: -76, y: 0 }, 50)).toEqual({ x: -100, y: 0 });
  });
});
