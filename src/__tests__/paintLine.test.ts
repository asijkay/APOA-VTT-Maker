import { describe, it, expect } from 'vitest';
import { rasterizeLineCells } from '@/vtt/editor/tools/PaintTools';

function coords(points: Array<{ gx: number; gy: number }>): string[] {
  return points.map((p) => `${p.gx},${p.gy}`);
}

describe('rasterizeLineCells (Bresenham for paint drags)', () => {
  it('handles zero-length single cell', () => {
    expect(coords(rasterizeLineCells(3, 4, 3, 4))).toEqual(['3,4']);
  });

  it('handles horizontal right', () => {
    expect(coords(rasterizeLineCells(0, 0, 5, 0))).toEqual([
      '0,0',
      '1,0',
      '2,0',
      '3,0',
      '4,0',
      '5,0',
    ]);
  });

  it('handles horizontal left', () => {
    expect(coords(rasterizeLineCells(5, 0, 0, 0))).toEqual([
      '5,0',
      '4,0',
      '3,0',
      '2,0',
      '1,0',
      '0,0',
    ]);
  });

  it('handles vertical down', () => {
    expect(coords(rasterizeLineCells(2, -1, 2, 3))).toEqual([
      '2,-1',
      '2,0',
      '2,1',
      '2,2',
      '2,3',
    ]);
  });

  it('handles diagonal with shallow slope', () => {
    const got = coords(rasterizeLineCells(0, 0, 5, 2));
    expect(got[0]).toBe('0,0');
    expect(got[got.length - 1]).toBe('5,2');
    for (const p of got) {
      const [x, y] = p.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(5);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(2);
    }
    expect(got.length).toBe(6);
  });

  it('handles negative direction diagonal', () => {
    const a = coords(rasterizeLineCells(4, 4, 0, 0));
    expect(a[0]).toBe('4,4');
    expect(a[a.length - 1]).toBe('0,0');
    expect(a.length).toBe(5);
  });

  it('does not exceed sensible steps even for pathological input', () => {
    const huge = rasterizeLineCells(0, 0, 1000, -1000);
    expect(huge.length).toBeLessThanOrEqual(2001 * 2);
    expect(huge[0]).toEqual({ gx: 0, gy: 0 });
    expect(huge[huge.length - 1]).toEqual({ gx: 1000, gy: -1000 });
  });
});
