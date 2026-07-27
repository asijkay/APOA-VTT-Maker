import { describe, it, expect, beforeEach } from 'vitest';
import { Camera } from '@/vtt/engine/Camera';

describe('Camera', () => {
  let camera: Camera;

  beforeEach(() => {
    camera = new Camera();
    camera.setViewportSize(800, 600);
  });

  it('screen center maps to camera position at zoom 1', () => {
    const p = camera.screenToWorld(400, 300);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('world origin at zoom 1 maps to screen center', () => {
    const s = camera.worldToScreen(0, 0);
    expect(s.x).toBeCloseTo(400);
    expect(s.y).toBeCloseTo(300);
  });

  it('translate moves the camera correctly', () => {
    camera.translate(100, -50);
    const s = camera.worldToScreen(100, -50);
    expect(s.x).toBeCloseTo(400);
    expect(s.y).toBeCloseTo(300);
  });

  it('screenToWorld and worldToScreen are inverses at zoom 2', () => {
    camera.setZoom(2);
    for (const [sx, sy] of [[10, 20], [400, 300], [799, 599], [0, 0]]) {
      const w = camera.screenToWorld(sx, sy);
      const s2 = camera.worldToScreen(w.x, w.y);
      expect(s2.x).toBeCloseTo(sx);
      expect(s2.y).toBeCloseTo(sy);
    }
  });

  it('zoomAt keeps the world point under the cursor stationary', () => {
    const sx = 600;
    const sy = 450;
    const worldBefore = camera.screenToWorld(sx, sy);
    camera.zoomAt(sx, sy, 2);
    const worldAfter = camera.screenToWorld(sx, sy);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y);
  });

  it('setZoom clamps to min and max bounds', () => {
    camera.setZoom(0.0001);
    expect(camera.getState().zoom).toBeGreaterThanOrEqual(0.1);
    camera.setZoom(1000000);
    expect(camera.getState().zoom).toBeLessThanOrEqual(8);
  });

  it('getBounds has consistent corners', () => {
    camera.setPosition(10, 20);
    camera.setZoom(1);
    const b = camera.getBounds();
    const tl = camera.screenToWorld(0, 0);
    const br = camera.screenToWorld(b.viewportWidth, b.viewportHeight);
    expect(b.worldLeft).toBeCloseTo(tl.x);
    expect(b.worldTop).toBeCloseTo(tl.y);
    expect(b.worldRight).toBeCloseTo(br.x);
    expect(b.worldBottom).toBeCloseTo(br.y);
  });
});
