import { describe, it, expect, beforeEach } from 'vitest';
import { SceneStore } from '@/vtt/scene/SceneStore';

describe('Scene tokens', () => {
  let store: SceneStore;
  beforeEach(() => {
    store = new SceneStore();
  });

  it('adds token with defaults', () => {
    const r = store.addToken({ x: 25, y: 25 });
    expect(r?.id).toBeTruthy();
    const snap = store.snapshot();
    expect(snap.tokens).toHaveLength(1);
    expect(snap.tokens[0]).toMatchObject({
      x: 25,
      y: 25,
      elevation: 0,
      radius: 10,
      visionRadius: 300,
    });
  });

  it('uses custom radius and vision radius', () => {
    store.addToken({ x: 0, y: 0, radius: 20, visionRadius: 500 });
    const snap = store.snapshot();
    expect(snap.tokens[0]).toMatchObject({ radius: 20, visionRadius: 500 });
  });

  it('updates token position', () => {
    const { id } = store.addToken({ x: 0, y: 0 });
    expect(store.updateToken(id, { x: 100, y: 200 })).toBe(true);
    const after = store.snapshot().tokens[0];
    expect(after.x).toBe(100);
    expect(after.y).toBe(200);
  });

  it('removeToken removes token', () => {
    const { id } = store.addToken({ x: 0, y: 0 });
    expect(store.removeToken(id)).toBe(true);
    expect(store.snapshot().tokens).toHaveLength(0);
  });
});
