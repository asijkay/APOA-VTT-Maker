import type { Scene } from './SceneTypes';
import { createEmptyScene } from './SceneTypes';

const STORAGE_KEY = 'vtt-scene-v1';

/**
 * Validates and coerces a raw parsed object into a valid Scene.
 * Ensures missing arrays default to empty so old saves don't crash.
 */
function coerceScene(raw: unknown): Scene {
  if (typeof raw !== 'object' || raw === null) return createEmptyScene();
  const obj = raw as Record<string, unknown>;
  return {
    gridSize: typeof obj.gridSize === 'number' ? obj.gridSize : 25,
    mapWidth: typeof obj.mapWidth === 'number' ? obj.mapWidth : 25,
    mapHeight: typeof obj.mapHeight === 'number' ? obj.mapHeight : 25,
    floors: Array.isArray(obj.floors) ? obj.floors : [],
    walls: Array.isArray(obj.walls) ? obj.walls : [],
    doors: Array.isArray(obj.doors) ? obj.doors : [],
    lights: Array.isArray(obj.lights) ? obj.lights : [],
    tokens: Array.isArray(obj.tokens) ? obj.tokens : [],
    windows: Array.isArray(obj.windows) ? obj.windows : [],
    images: Array.isArray(obj.images) ? obj.images : [],
  };
}

export const PersistenceService = {
  /**
   * Saves the scene to localStorage. Silently swallows storage errors
   * (private/incognito mode may throw QuotaExceededError).
   */
  saveToLocalStorage(scene: Scene): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
    } catch {
      // Silently ignore storage errors
    }
  },

  /**
   * Loads the scene from localStorage. Returns null if nothing is stored
   * or if the stored data is corrupt.
   */
  loadFromLocalStorage(): Scene | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return coerceScene(JSON.parse(raw));
    } catch {
      return null;
    }
  },

  /**
   * Clears the saved scene from localStorage.
   */
  clearLocalStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently ignore
    }
  },

  /**
   * Triggers a browser file download containing the scene as JSON.
   */
  exportToFile(scene: Scene, filename = 'vtt-scene.json'): void {
    const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Opens a file picker and parses the selected JSON file as a Scene.
   * Returns null if the user cancels or the file is invalid.
   */
  importFromFile(): Promise<Scene | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        try {
          const text = await file.text();
          resolve(coerceScene(JSON.parse(text)));
        } catch {
          resolve(null);
        }
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
};
