import type { VttEngine } from '@/vtt/engine/VttEngine';
import type { Door, Light, Token, Wall, Window as VttWindow, MapImage } from '@/vtt/scene/SceneTypes';
import { useCallback, useRef, useState, useEffect } from 'react';
import { opUpdateSceneSettings } from '@/vtt/scene/UndoManager';

type Props = {
  selectedIds: ReadonlySet<string>;
  engine: VttEngine;
  sceneVersion: number;
};

function MapSettingsPanel({ snap, engine }: { snap: any, engine: any }) {
  const [w, setW] = useState(snap.mapWidth.toString());
  const [h, setH] = useState(snap.mapHeight.toString());

  useEffect(() => {
    setW(snap.mapWidth.toString());
    setH(snap.mapHeight.toString());
  }, [snap.mapWidth, snap.mapHeight]);

  const handleUpdate = () => {
    const nw = Math.max(1, Math.min(200, parseInt(w) || 1));
    const nh = Math.max(1, Math.min(200, parseInt(h) || 1));
    if (nw !== snap.mapWidth || nh !== snap.mapHeight) {
      engine.editor.getUndoManager().execute(
        opUpdateSceneSettings({ mapWidth: nw, mapHeight: nh }, { mapWidth: snap.mapWidth, mapHeight: snap.mapHeight })
      );
    }
  };

  return (
    <div className="properties-panel glass-panel">
      <h4>Map Settings</h4>
      <div className="prop-row row-between">
        <span style={{ color: 'var(--color-text-muted)' }}>Width</span>
        <input
          type="number" min={1} max={200} step={1} className="prop-input" style={{ width: 60, textAlign: 'right' }}
          value={w}
          onChange={e => setW(e.target.value)}
        />
        <span style={{ color: 'var(--color-text-muted)' }}>cells</span>
      </div>
      <div className="prop-row row-between">
        <span style={{ color: 'var(--color-text-muted)' }}>Height</span>
        <input
          type="number" min={1} max={200} step={1} className="prop-input" style={{ width: 60, textAlign: 'right' }}
          value={h}
          onChange={e => setH(e.target.value)}
        />
        <span style={{ color: 'var(--color-text-muted)' }}>cells</span>
      </div>
      <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={handleUpdate}>
        Update Map
      </button>
    </div>
  );
}

export default function PropertiesPanel({ selectedIds, engine, sceneVersion }: Props) {
  void sceneVersion;

  if (selectedIds.size > 1) {
    return (
      <div className="properties-panel glass-panel">
        <h4>Multiple Selected</h4>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          {selectedIds.size} objects selected
        </div>
      </div>
    );
  }

  const selectedId = Array.from(selectedIds)[0];
  const sceneStore = engine.getScene();

  if (!selectedId) {
    const snap = sceneStore.snapshot();
    return <MapSettingsPanel snap={snap} engine={engine} />;
  }
  const wall   = sceneStore.findWallById(selectedId);
  const door   = sceneStore.findDoorById(selectedId);
  const light  = sceneStore.findLightById(selectedId);
  const token  = sceneStore.findTokenById(selectedId);
  const win    = sceneStore.findWindowById(selectedId);
  const img    = sceneStore.findImageById(selectedId);

  const handleUpdateWall  = useCallback((p: Partial<Omit<Wall, 'id'>>) => sceneStore.updateWall(selectedId, p),  [sceneStore, selectedId]);
  const handleUpdateDoor  = useCallback((p: Partial<Omit<Door, 'id'>>) => sceneStore.updateDoor(selectedId, p),  [sceneStore, selectedId]);
  const handleUpdateLight = useCallback((p: Partial<Omit<Light, 'id'>>) => sceneStore.updateLight(selectedId, p), [sceneStore, selectedId]);
  const handleUpdateToken = useCallback((p: Partial<Omit<Token, 'id'>>) => sceneStore.updateToken(selectedId, p), [sceneStore, selectedId]);
  const handleUpdateWin   = useCallback((p: Partial<Omit<VttWindow, 'id'>>) => sceneStore.updateWindow(selectedId, p), [sceneStore, selectedId]);
  const handleUpdateImage = useCallback((p: Partial<Omit<MapImage, 'id'>>) => sceneStore.updateImage(selectedId, p), [sceneStore, selectedId]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Wall ─────────────────────────────────────────────────────────────────
  if (wall) {
    return (
      <div className="properties-panel glass-panel">
        <h4>Wall</h4>
        <label className="prop-row row-between">
          <input type="checkbox" checked={wall.blocksVision}
            onChange={e => handleUpdateWall({ blocksVision: e.target.checked })} />
          Blocks Vision
        </label>
        <label className="prop-row row-between">
          <input type="checkbox" checked={wall.blocksMovement}
            onChange={e => handleUpdateWall({ blocksMovement: e.target.checked })} />
          Blocks Movement
        </label>
      </div>
    );
  }

  // ── Door ─────────────────────────────────────────────────────────────────
  if (door) {
    return (
      <div className="properties-panel glass-panel">
        <h4>Door</h4>

        <div className="prop-row row-between">
          <button className={`btn ${door.state === 'closed' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }}
            onClick={() => handleUpdateDoor({ state: 'closed' })}>🚪 Closed</button>
          <button className={`btn ${door.state === 'open' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }}
            onClick={() => handleUpdateDoor({ state: 'open' })}>↩️ Open</button>
        </div>

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }}
          onClick={() => {
            const w = engine.getScene().findWallById(door.wallId);
            if (!w) return;
            handleUpdateDoor({ position: 0.5 });
          }}>
          Center on Wall
        </button>

        <label className="prop-row row-between" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={door.locked}
            onChange={e => handleUpdateDoor({ locked: e.target.checked })} />
          Locked
        </label>
        <label className="prop-row row-between">
          <input type="checkbox" checked={door.hidden}
            onChange={e => handleUpdateDoor({ hidden: e.target.checked })} />
          Hidden
        </label>
      </div>
    );
  }

  // ── Window ────────────────────────────────────────────────────────────────
  if (win) {
    return (
      <div className="properties-panel glass-panel">
        <h4>Window</h4>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          Vision &amp; light pass through. Movement blocked.
        </div>
        <div className="prop-row">
          <span>Width: {win.width}px</span>
          <input type="range" min={10} max={120} step={5}
            value={win.width}
            onChange={e => handleUpdateWin({ width: Number(e.target.value) })} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          Position: {(win.position * 100).toFixed(0)}% along wall
        </div>
      </div>
    );
  }

  // ── Light ─────────────────────────────────────────────────────────────────
  if (light) {
    return (
      <div className="properties-panel glass-panel">
        <h4>Light</h4>
        <div className="prop-row">
          <span>Radius: {light.radius}px</span>
          <input type="range" min={10} max={1000} step={10}
            value={light.radius}
            onChange={e => handleUpdateLight({ radius: Number(e.target.value) })} />
        </div>
        <div className="prop-row row-between">
          <span>Color</span>
          <input type="color" value={light.color}
            onChange={e => handleUpdateLight({ color: e.target.value })}
            style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} />
        </div>
        <label className="prop-row row-between">
          <input type="checkbox" checked={light.enabled}
            onChange={e => handleUpdateLight({ enabled: e.target.checked })} />
          Enabled
        </label>
      </div>
    );
  }

  // ── Token ─────────────────────────────────────────────────────────────────
  if (token) {
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) handleUpdateToken({ imageUrl: dataUrl });
      };
      reader.readAsDataURL(file);
    };

    const handleClearImage = () => {
      handleUpdateToken({ imageUrl: undefined });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
      <div className="properties-panel glass-panel">
        <h4>Token</h4>

        {/* Name */}
        <div className="prop-row">
          <span>Name</span>
          <input type="text" className="prop-input"
            value={token.name ?? ''}
            onChange={e => handleUpdateToken({ name: e.target.value })}
            placeholder="Token name…" />
        </div>

        {/* Owner ID */}
        <div className="prop-row">
          <span>Owner (Peer ID)</span>
          <input type="text" className="prop-input"
            value={token.ownerId ?? ''}
            onChange={e => handleUpdateToken({ ownerId: e.target.value || undefined })}
            placeholder="e.g. peer-12345 (Leave empty for all)" />
        </div>

        {/* Portrait image */}
        <div className="prop-row">
          <span>Portrait</span>
          {token.imageUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <img src={token.imageUrl} alt="portrait"
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }} />
              <button onClick={handleClearImage}
                className="btn btn-secondary" style={{ color: 'var(--color-danger)' }}>
                Remove
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*"
            style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
            onChange={handleImageUpload} />
        </div>

        {/* Size */}
        <div className="prop-row">
          <span>Size radius: {token.radius}px</span>
          <input type="range" min={5} max={100} step={1}
            value={token.radius}
            onChange={e => handleUpdateToken({ radius: Number(e.target.value) })} />
        </div>

        {/* Vision */}
        <div className="prop-row">
          <span>Vision radius: {token.visionRadius}px</span>
          <input type="range" min={0} max={2000} step={10}
            value={token.visionRadius}
            onChange={e => handleUpdateToken({ visionRadius: Number(e.target.value) })} />
        </div>
      </div>
    );
  }

  // ── Image ─────────────────────────────────────────────────────────────────
  if (img) {
    const handleMapImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) handleUpdateImage({ url: dataUrl });
      };
      reader.readAsDataURL(file);
    };

    return (
      <div className="properties-panel glass-panel">
        <h4>Image</h4>
        <div className="prop-row">
          <span>URL</span>
          <input type="text" className="prop-input"
            value={img.url ?? ''}
            onChange={e => handleUpdateImage({ url: e.target.value })}
            placeholder="https://..." />
        </div>
        <div className="prop-row">
          <span>Upload</span>
          <input type="file" accept="image/*"
            style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
            onChange={handleMapImageUpload} />
        </div>
        <div className="prop-row">
          <span>Width: {img.width}</span>
          <input type="range" min={100} max={4000} step={50}
            value={img.width}
            onChange={e => handleUpdateImage({ width: Number(e.target.value) })} />
        </div>
        <div className="prop-row">
          <span>Height: {img.height}</span>
          <input type="range" min={100} max={4000} step={50}
            value={img.height}
            onChange={e => handleUpdateImage({ height: Number(e.target.value) })} />
        </div>
        <div className="prop-row">
          <span>Opacity: {img.opacity}</span>
          <input type="range" min={0.1} max={1} step={0.1}
            value={img.opacity}
            onChange={e => handleUpdateImage({ opacity: Number(e.target.value) })} />
        </div>
        <label className="prop-row row-between">
          <input type="checkbox" checked={img.locked}
            onChange={e => handleUpdateImage({ locked: e.target.checked })} />
          Locked
        </label>
      </div>
    );
  }

  return null;
}
