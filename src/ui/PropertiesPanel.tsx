import type { VttEngine } from '@/vtt/engine/VttEngine';
import type { Door, Light, Token, Wall } from '@/vtt/scene/SceneTypes';
import { useCallback } from 'react';

type Props = {
  selectedId: string;
  engine: VttEngine;
  sceneVersion: number;
};

export default function PropertiesPanel({ selectedId, engine, sceneVersion }: Props) {
  // Using sceneVersion to force re-render when scene changes
  void sceneVersion;

  const sceneStore = engine.getScene();
  const wall = sceneStore.findWallById(selectedId);
  const door = sceneStore.findDoorById(selectedId);
  const light = sceneStore.findLightById(selectedId);
  const token = sceneStore.findTokenById(selectedId);

  const handleUpdateWall = useCallback((patch: Partial<Omit<Wall, 'id'>>) => {
    sceneStore.updateWall(selectedId, patch);
  }, [sceneStore, selectedId]);

  const handleUpdateDoor = useCallback((patch: Partial<Omit<Door, 'id'>>) => {
    sceneStore.updateDoor(selectedId, patch);
  }, [sceneStore, selectedId]);

  const handleUpdateLight = useCallback((patch: Partial<Omit<Light, 'id'>>) => {
    sceneStore.updateLight(selectedId, patch);
  }, [sceneStore, selectedId]);

  const handleUpdateToken = useCallback((patch: Partial<Omit<Token, 'id'>>) => {
    sceneStore.updateToken(selectedId, patch);
  }, [sceneStore, selectedId]);

  if (wall) {
    return (
      <div className="properties-panel">
        <h3>Wall Properties</h3>
        <label>
          <input
            type="checkbox"
            checked={wall.blocksVision}
            onChange={(e) => handleUpdateWall({ blocksVision: e.target.checked })}
          />
          Blocks Vision
        </label>
        <label>
          <input
            type="checkbox"
            checked={wall.blocksMovement}
            onChange={(e) => handleUpdateWall({ blocksMovement: e.target.checked })}
          />
          Blocks Movement
        </label>
      </div>
    );
  }

  if (door) {
    return (
      <div className="properties-panel">
        <h3>Door Properties</h3>
        <label>
          State:
          <select
            value={door.state}
            onChange={(e) => handleUpdateDoor({ state: e.target.value as 'open' | 'closed' })}
          >
            <option value="closed">Closed</option>
            <option value="open">Open</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={door.locked}
            onChange={(e) => handleUpdateDoor({ locked: e.target.checked })}
          />
          Locked
        </label>
        <label>
          <input
            type="checkbox"
            checked={door.hidden}
            onChange={(e) => handleUpdateDoor({ hidden: e.target.checked })}
          />
          Hidden
        </label>
      </div>
    );
  }

  if (light) {
    return (
      <div className="properties-panel">
        <h3>Light Properties</h3>
        <label>
          Radius ({light.radius})
          <input
            type="range"
            min="10"
            max="1000"
            step="10"
            value={light.radius}
            onChange={(e) => handleUpdateLight({ radius: Number(e.target.value) })}
          />
        </label>
        <label>
          Color
          <input
            type="color"
            value={light.color}
            onChange={(e) => handleUpdateLight({ color: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={light.enabled}
            onChange={(e) => handleUpdateLight({ enabled: e.target.checked })}
          />
          Enabled
        </label>
      </div>
    );
  }

  if (token) {
    return (
      <div className="properties-panel">
        <h3>Token Properties</h3>
        <label>
          Size Radius ({token.radius})
          <input
            type="range"
            min="5"
            max="100"
            step="1"
            value={token.radius}
            onChange={(e) => handleUpdateToken({ radius: Number(e.target.value) })}
          />
        </label>
        <label>
          Vision Radius ({token.visionRadius})
          <input
            type="range"
            min="0"
            max="2000"
            step="10"
            value={token.visionRadius}
            onChange={(e) => handleUpdateToken({ visionRadius: Number(e.target.value) })}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <h3>Properties</h3>
      <p>Unknown object selected.</p>
    </div>
  );
}
