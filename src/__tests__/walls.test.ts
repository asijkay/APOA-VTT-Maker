import { describe, it, expect } from 'vitest';
import { SceneStore } from '@/vtt/scene/SceneStore';
import { createEmptyScene } from '@/vtt/scene/SceneTypes';

describe('Walls', () => {
  it('adds wall with defaults', () => {
    const store = new SceneStore(createEmptyScene());
    const r = store.addWall({ x1: 0, y1: 0, x2: 100, y2: 100 });
    expect(r?.id).toBeTruthy();
    expect(store.snapshot().walls).toHaveLength(1);
  });
});
