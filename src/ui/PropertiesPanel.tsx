import type { VttEngine } from '@/vtt/engine/VttEngine';
import type { Door, Light, Token, Wall, Window as VttWindow, MapImage } from '@/vtt/scene/SceneTypes';
import { useCallback, useRef, useState, useEffect } from 'react';
import { opUpdateSceneSettings } from '@/vtt/scene/UndoManager';

type Props = {
  selectedIds: ReadonlySet<string>;
  engine: VttEngine;
  sceneVersion: number;
};

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  right: 12,
  top: 12,
  zIndex: 10,
  background: 'rgba(18, 22, 28, 0.94)',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255, 255, 255, 0.10)',
  color: '#d6dbe2',
  fontSize: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  backdropFilter: 'blur(8px)',
  minWidth: 210,
  maxWidth: 240,
};

const labelRow: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

const rowBetween: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 5,
  color: '#d6dbe2',
  padding: '3px 7px',
  fontSize: 12,
  width: '100%',
  boxSizing: 'border-box',
};

const rangeStyle: React.CSSProperties = { width: '100%', accentColor: '#63b3ed' };

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#90cdf4',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 2,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  paddingBottom: 4,
};

const bigButtonStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '5px 0',
  borderRadius: 6,
  border: `1px solid ${active ? 'rgba(99,179,237,0.6)' : 'rgba(255,255,255,0.12)'}`,
  background: active ? 'rgba(99,179,237,0.22)' : 'rgba(255,255,255,0.06)',
  color: active ? '#90cdf4' : '#a0aec0',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
});

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
    <div style={panelStyle}>
      <div style={sectionTitle}>Map Settings</div>
      <div style={rowBetween}>
        <span style={{ color: '#a0aec0', fontSize: 11 }}>Width</span>
        <input
          type="number" min={1} max={200} step={1} style={{ ...inputStyle, width: 60, textAlign: 'right' }}
          value={w}
          onChange={e => setW(e.target.value)}
        />
        <span style={{ color: '#718096', fontSize: 11 }}>cells</span>
      </div>
      <div style={rowBetween}>
        <span style={{ color: '#a0aec0', fontSize: 11 }}>Height</span>
        <input
          type="number" min={1} max={200} step={1} style={{ ...inputStyle, width: 60, textAlign: 'right' }}
          value={h}
          onChange={e => setH(e.target.value)}
        />
        <span style={{ color: '#718096', fontSize: 11 }}>cells</span>
      </div>
      <button style={{ ...bigButtonStyle(false), width: '100%', marginTop: 8 }} onClick={handleUpdate}>
        Update Map
      </button>
    </div>
  );
}

export default function PropertiesPanel({ selectedIds, engine, sceneVersion }: Props) {
  void sceneVersion;

  if (selectedIds.size > 1) {
    return (
      <div style={panelStyle}>
        <div style={sectionTitle}>Multiple Selected</div>
        <div style={{ color: '#a0aec0', fontSize: 12 }}>
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
      <div style={panelStyle}>
        <div style={sectionTitle}>Wall</div>
        <label style={rowBetween}>
          <input type="checkbox" checked={wall.blocksVision}
            onChange={e => handleUpdateWall({ blocksVision: e.target.checked })} />
          Blocks Vision
        </label>
        <label style={rowBetween}>
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
      <div style={panelStyle}>
        <div style={sectionTitle}>Door</div>

        {/* Big open/closed toggle */}
        <div style={rowBetween}>
          <button style={bigButtonStyle(door.state === 'closed')}
            onClick={() => handleUpdateDoor({ state: 'closed' })}>🚪 Closed</button>
          <button style={bigButtonStyle(door.state === 'open')}
            onClick={() => handleUpdateDoor({ state: 'open' })}>↩️ Open</button>
        </div>

        <button style={{
          ...bigButtonStyle(false),
          padding: '4px 8px', fontSize: 11, marginTop: 4, opacity: door.state === 'open' ? 1 : 0.5
        }}
          onClick={() => handleUpdateDoor({ swingDirection: (door.swingDirection === -1 ? 1 : -1) })}>
          🔄 Flip Swing Direction
        </button>

        <div style={labelRow}>
          <span>Width: {door.width}px</span>
          <input type="range" min={10} max={200} step={5} style={rangeStyle}
            value={door.width}
            onChange={e => handleUpdateDoor({ width: Number(e.target.value) })} />
        </div>

        <label style={rowBetween}>
          <input type="checkbox" checked={door.locked}
            onChange={e => handleUpdateDoor({ locked: e.target.checked })} />
          🔒 Locked
        </label>
        <label style={rowBetween}>
          <input type="checkbox" checked={door.hidden}
            onChange={e => handleUpdateDoor({ hidden: e.target.checked })} />
          👻 Hidden from players
        </label>
      </div>
    );
  }

  // ── Window ────────────────────────────────────────────────────────────────
  if (win) {
    return (
      <div style={panelStyle}>
        <div style={sectionTitle}>Window</div>
        <div style={{ fontSize: 11, color: '#718096' }}>
          Vision &amp; light pass through. Movement blocked.
        </div>
        <div style={labelRow}>
          <span>Width: {win.width}px</span>
          <input type="range" min={10} max={120} step={5} style={rangeStyle}
            value={win.width}
            onChange={e => handleUpdateWin({ width: Number(e.target.value) })} />
        </div>
        <div style={{ fontSize: 11, color: '#4a5568' }}>
          Position: {(win.position * 100).toFixed(0)}% along wall
        </div>
      </div>
    );
  }

  // ── Light ─────────────────────────────────────────────────────────────────
  if (light) {
    return (
      <div style={panelStyle}>
        <div style={sectionTitle}>Light</div>
        <div style={labelRow}>
          <span>Radius: {light.radius}px</span>
          <input type="range" min={10} max={1000} step={10} style={rangeStyle}
            value={light.radius}
            onChange={e => handleUpdateLight({ radius: Number(e.target.value) })} />
        </div>
        <div style={rowBetween}>
          <span>Color</span>
          <input type="color" value={light.color}
            onChange={e => handleUpdateLight({ color: e.target.value })}
            style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} />
        </div>
        <label style={rowBetween}>
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
      <div style={panelStyle}>
        <div style={sectionTitle}>Token</div>

        {/* Name */}
        <div style={labelRow}>
          <span>Name</span>
          <input type="text" style={inputStyle}
            value={token.name ?? ''}
            onChange={e => handleUpdateToken({ name: e.target.value })}
            placeholder="Token name…" />
        </div>

        {/* Portrait image */}
        <div style={labelRow}>
          <span>Portrait</span>
          {token.imageUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <img src={token.imageUrl} alt="portrait"
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }} />
              <button onClick={handleClearImage}
                style={{ ...inputStyle, width: 'auto', padding: '2px 8px', cursor: 'pointer', color: '#fc8181' }}>
                Remove
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*"
            style={{ fontSize: 11, color: '#718096' }}
            onChange={handleImageUpload} />
        </div>

        {/* Size */}
        <div style={labelRow}>
          <span>Size radius: {token.radius}px</span>
          <input type="range" min={5} max={100} step={1} style={rangeStyle}
            value={token.radius}
            onChange={e => handleUpdateToken({ radius: Number(e.target.value) })} />
        </div>

        {/* Vision */}
        <div style={labelRow}>
          <span>Vision radius: {token.visionRadius}px</span>
          <input type="range" min={0} max={2000} step={10} style={rangeStyle}
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
      <div style={panelStyle}>
        <div style={sectionTitle}>Image</div>
        <div style={labelRow}>
          <span>URL</span>
          <input type="text" style={inputStyle}
            value={img.url ?? ''}
            onChange={e => handleUpdateImage({ url: e.target.value })}
            placeholder="https://..." />
        </div>
        <div style={labelRow}>
          <span>Upload</span>
          <input type="file" accept="image/*"
            style={{ fontSize: 11, color: '#718096' }}
            onChange={handleMapImageUpload} />
        </div>
        <div style={labelRow}>
          <span>Width: {img.width}</span>
          <input type="range" min={100} max={4000} step={50} style={rangeStyle}
            value={img.width}
            onChange={e => handleUpdateImage({ width: Number(e.target.value) })} />
        </div>
        <div style={labelRow}>
          <span>Height: {img.height}</span>
          <input type="range" min={100} max={4000} step={50} style={rangeStyle}
            value={img.height}
            onChange={e => handleUpdateImage({ height: Number(e.target.value) })} />
        </div>
        <div style={labelRow}>
          <span>Opacity: {img.opacity}</span>
          <input type="range" min={0.1} max={1} step={0.1} style={rangeStyle}
            value={img.opacity}
            onChange={e => handleUpdateImage({ opacity: Number(e.target.value) })} />
        </div>
        <label style={rowBetween}>
          <input type="checkbox" checked={img.locked}
            onChange={e => handleUpdateImage({ locked: e.target.checked })} />
          🔒 Locked
        </label>
      </div>
    );
  }

  return null;
}
