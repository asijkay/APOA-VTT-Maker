import type { VttEngine } from '@/vtt/engine/VttEngine';
import type { Door, Light, Token, Wall, Window as VttWindow, MapImage } from '@/vtt/scene/SceneTypes';
import { useCallback, useRef, useState, useEffect } from 'react';
import { opUpdateSceneSettings } from '@/vtt/scene/UndoManager';
import type { PlayerInfo } from '@/vtt/network/protocol';

type Props = {
  selectedIds: ReadonlySet<string>;
  engine: VttEngine;
  sceneVersion: number;
  /** Connected players, offered as owners for a token. */
  players?: PlayerInfo[];
  selfId?: string;
};

function MapSettingsPanel({ snap, engine }: { snap: any, engine: any }) {
  const [w, setW] = useState(snap.mapWidth.toString());
  const [h, setH] = useState(snap.mapHeight.toString());
  const [ambientLevel, setAmbientLevel] = useState(snap.ambientLightLevel ?? 1.0);
  const [ambientColor, setAmbientColor] = useState(snap.ambientLightColor ?? '#ffffff');

  useEffect(() => {
    setW(snap.mapWidth.toString());
    setH(snap.mapHeight.toString());
    setAmbientLevel(snap.ambientLightLevel ?? 1.0);
    setAmbientColor(snap.ambientLightColor ?? '#ffffff');
  }, [snap.mapWidth, snap.mapHeight, snap.ambientLightLevel, snap.ambientLightColor]);

  const handleUpdate = () => {
    const nw = Math.max(1, Math.min(200, parseInt(w) || 1));
    const nh = Math.max(1, Math.min(200, parseInt(h) || 1));
    const isMapChanged = nw !== snap.mapWidth || nh !== snap.mapHeight;
    const isLightChanged = ambientLevel !== snap.ambientLightLevel || ambientColor !== snap.ambientLightColor;
    
    if (isMapChanged || isLightChanged) {
      engine.editor.getUndoManager().execute(
        opUpdateSceneSettings(
          { mapWidth: nw, mapHeight: nh, ambientLightLevel: ambientLevel, ambientLightColor: ambientColor }, 
          { mapWidth: snap.mapWidth, mapHeight: snap.mapHeight, ambientLightLevel: snap.ambientLightLevel, ambientLightColor: snap.ambientLightColor }
        )
      );
    }
  };

  return (
    <aside className="panel properties-panel" aria-label="Map settings">
      <div className="panel-head"><span className="panel-title">Map</span><span className="panel-sub">nothing selected</span></div>

      <div className="field-split">
        <label className="field">Width (cells)
          <input type="number" min={1} max={200} step={1} className="prop-input" value={w} onChange={e => setW(e.target.value)} />
        </label>
        <label className="field">Height (cells)
          <input type="number" min={1} max={200} step={1} className="prop-input" value={h} onChange={e => setH(e.target.value)} />
        </label>
      </div>

      <div className="panel-rule" />
      <div className="label">Global illumination</div>

      <div className="field">
        <div className="field-between"><span>Ambient level</span><span className="field-value">{Math.round(ambientLevel * 100)}%</span></div>
        <input type="range" min={0} max={1} step={0.01} value={ambientLevel} onChange={e => setAmbientLevel(parseFloat(e.target.value))} />
      </div>

      <div className="field-row">
        <span>Ambient colour</span>
        <input type="color" className="prop-input" value={ambientColor} onChange={e => setAmbientColor(e.target.value)} />
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={handleUpdate}>Update map</button>
    </aside>
  );
}

export default function PropertiesPanel({ selectedIds, engine, sceneVersion, players = [], selfId }: Props) {
  void sceneVersion;

  // Hooks must run on every render, before any early return below (the selection can be empty or multiple).
  const selectedId = Array.from(selectedIds)[0] as string | undefined;
  const sceneStore = engine.getScene();
  const handleUpdateWall  = useCallback((p: Partial<Omit<Wall, 'id'>>) => { if (selectedId) sceneStore.updateWall(selectedId, p); },  [sceneStore, selectedId]);
  const handleUpdateDoor  = useCallback((p: Partial<Omit<Door, 'id'>>) => { if (selectedId) sceneStore.updateDoor(selectedId, p); },  [sceneStore, selectedId]);
  const handleUpdateLight = useCallback((p: Partial<Omit<Light, 'id'>>) => { if (selectedId) sceneStore.updateLight(selectedId, p); }, [sceneStore, selectedId]);
  const handleUpdateToken = useCallback((p: Partial<Omit<Token, 'id'>>) => { if (selectedId) sceneStore.updateToken(selectedId, p); }, [sceneStore, selectedId]);
  const handleUpdateWin   = useCallback((p: Partial<Omit<VttWindow, 'id'>>) => { if (selectedId) sceneStore.updateWindow(selectedId, p); }, [sceneStore, selectedId]);
  const handleUpdateImage = useCallback((p: Partial<Omit<MapImage, 'id'>>) => { if (selectedId) sceneStore.updateImage(selectedId, p); }, [sceneStore, selectedId]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDelete = () => { engine.deleteSelection(); };
  const DeleteButton = ({ label, disabled = false, why }: { label: string; disabled?: boolean; why?: string }) => (
    <>
      <div className="panel-rule" />
      <button type="button" className="btn btn-rose btn-block" onClick={onDelete} disabled={disabled} title={disabled ? why : undefined}>{label}</button>
      {disabled && why && <span className="field-hint">{why}</span>}
    </>
  );

  if (selectedIds.size > 1) {
    return (
      <aside className="panel properties-panel" aria-label="Properties">
        <div className="panel-head"><span className="panel-title">Selection</span><span className="panel-sub">{selectedIds.size} selected</span></div>
        <p className="panel-sub">Drag to move them together, or delete them all in one step.</p>
        <DeleteButton label={`Delete ${selectedIds.size} objects`} />
      </aside>
    );
  }

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

  const Head = ({ title }: { title: string }) => (
    <div className="panel-head"><span className="panel-title">{title}</span><span className="panel-sub">1 selected</span></div>
  );

  // ── Wall ─────────────────────────────────────────────────────────────────
  if (wall) {
    return (
      <aside className="panel properties-panel" aria-label="Properties">
        <Head title="Wall" />
        <label className="field-row"><span>Blocks vision</span>
          <input type="checkbox" className="switch" checked={wall.blocksVision} onChange={e => handleUpdateWall({ blocksVision: e.target.checked })} />
        </label>
        <label className="field-row"><span>Blocks movement</span>
          <input type="checkbox" className="switch" checked={wall.blocksMovement} onChange={e => handleUpdateWall({ blocksMovement: e.target.checked })} />
        </label>
        <DeleteButton label="Delete wall" />
      </aside>
    );
  }

  // ── Door ─────────────────────────────────────────────────────────────────
  if (door) {
    return (
      <aside className="panel properties-panel" aria-label="Properties">
        <Head title="Door" />
        <div className="seg" role="group" aria-label="Door state">
          <button type="button" className={door.state === 'closed' ? 'is-active' : ''} aria-pressed={door.state === 'closed'} onClick={() => handleUpdateDoor({ state: 'closed' })}>Closed</button>
          <button type="button" className={door.state === 'open' ? 'is-active' : ''} aria-pressed={door.state === 'open'} onClick={() => handleUpdateDoor({ state: 'open' })}>Open</button>
        </div>
        <button type="button" className="btn btn-block"
          onClick={() => {
            const w = engine.getScene().findWallById(door.wallId);
            if (!w) return;
            handleUpdateDoor({ position: 0.5 });
          }}>
          Centre on wall
        </button>
        <label className="field-row"><span>Locked</span>
          <input type="checkbox" className="switch" checked={door.locked} onChange={e => handleUpdateDoor({ locked: e.target.checked })} />
        </label>
        <label className="field-row"><span>Hidden from players</span>
          <input type="checkbox" className="switch" checked={door.hidden} onChange={e => handleUpdateDoor({ hidden: e.target.checked })} />
        </label>
        <DeleteButton label="Delete door" />
      </aside>
    );
  }

  // ── Window ────────────────────────────────────────────────────────────────
  if (win) {
    return (
      <aside className="panel properties-panel" aria-label="Properties">
        <Head title="Window" />
        <p className="panel-sub">Sight and light pass through. Movement is blocked.</p>
        <div className="field">
          <div className="field-between"><span>Width</span><span className="field-value">{win.width}px</span></div>
          <input type="range" min={10} max={120} step={5} value={win.width} onChange={e => handleUpdateWin({ width: Number(e.target.value) })} />
        </div>
        <div className="field-hint">{(win.position * 100).toFixed(0)}% along the wall</div>
        <DeleteButton label="Delete window" />
      </aside>
    );
  }

  // ── Light ─────────────────────────────────────────────────────────────────
  if (light) {
    return (
      <aside className="panel properties-panel" aria-label="Properties">
        <Head title="Light" />
        <div className="field">
          <div className="field-between"><span>Radius</span><span className="field-value">{light.radius}px</span></div>
          <input type="range" min={10} max={1000} step={10} value={light.radius} onChange={e => handleUpdateLight({ radius: Number(e.target.value) })} />
        </div>
        <div className="field-row"><span>Colour</span>
          <input type="color" className="prop-input" value={light.color} onChange={e => handleUpdateLight({ color: e.target.value })} />
        </div>
        <label className="field-row"><span>Enabled</span>
          <input type="checkbox" className="switch" checked={light.enabled} onChange={e => handleUpdateLight({ enabled: e.target.checked })} />
        </label>
        <DeleteButton label="Delete light" />
      </aside>
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

    const ownerOnline = !!token.ownerId && (token.ownerId === selfId || players.some(p => p.id === token.ownerId));
    const ownerHint = !token.ownerId
      ? 'No owner: only the GM can move it'
      : ownerOnline ? 'That player is online' : 'That player is not connected right now';

    return (
      <aside className="panel properties-panel" aria-label="Properties">
        <Head title="Token" />

        <label className="field">Name
          <input type="text" className="prop-input" value={token.name ?? ''} onChange={e => handleUpdateToken({ name: e.target.value })} placeholder="Token name…" />
        </label>

        <label className="field">Owner
          <input type="text" className="prop-input" list="vtt-player-ids" value={token.ownerId ?? ''}
            onChange={e => handleUpdateToken({ ownerId: e.target.value || undefined })}
            placeholder="Pick a connected player" />
          <datalist id="vtt-player-ids">
            {selfId && <option value={selfId}>you</option>}
            {players.filter(p => p.id !== selfId).map(p => (
              <option key={p.id} value={p.id}>{p.isGM ? 'GM' : 'player'}</option>
            ))}
          </datalist>
          <span className={`field-hint${ownerOnline ? ' is-ok' : ''}`}>{ownerHint}</span>
        </label>

        <div className="field">
          <div className="field-between"><span>Vision radius</span><span className="field-value">{token.visionRadius}</span></div>
          <input type="range" min={0} max={2000} step={10} value={token.visionRadius} onChange={e => handleUpdateToken({ visionRadius: Number(e.target.value) })} />
        </div>

        <div className="field-split">
          <label className="field">Size
            <input type="number" min={5} max={100} step={1} className="prop-input" value={token.radius}
              onChange={e => handleUpdateToken({ radius: Math.max(5, Math.min(100, Number(e.target.value) || 5)) })} />
          </label>
          <label className="field">Elevation
            <input type="number" step={1} className="prop-input" value={token.elevation}
              onChange={e => handleUpdateToken({ elevation: Number(e.target.value) || 0 })} />
          </label>
        </div>

        <label className="field-row"><span>Hidden from players</span>
          <input type="checkbox" className="switch" checked={!!token.hidden} onChange={e => handleUpdateToken({ hidden: e.target.checked })} />
        </label>

        <div className="field-row">
          <span>Portrait</span>
          <div className="portrait-row">
            {token.imageUrl && <img className="portrait" src={token.imageUrl} alt="Token portrait" />}
            {token.imageUrl && <button type="button" className="btn btn-sm btn-rose" onClick={handleClearImage}>Remove</button>}
            <button type="button" className="btn btn-sm" onClick={() => fileInputRef.current?.click()}>Upload…</button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
        </div>

        <DeleteButton label="Delete token" />
      </aside>
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
      <aside className="panel properties-panel" aria-label="Properties">
        <Head title="Map image" />
        <label className="field">Image URL
          <input type="text" className="prop-input" value={img.url.startsWith('data:') ? '(uploaded file)' : img.url}
            readOnly={img.url.startsWith('data:')}
            onChange={e => handleUpdateImage({ url: e.target.value })} placeholder="https://…" />
        </label>
        <label className="field">Upload a file
          <input type="file" accept="image/*" onChange={handleMapImageUpload} />
        </label>
        <div className="field">
          <div className="field-between"><span>Width</span><span className="field-value">{img.width}</span></div>
          <input type="range" min={100} max={4000} step={50} value={img.width} onChange={e => handleUpdateImage({ width: Number(e.target.value) })} />
        </div>
        <div className="field">
          <div className="field-between"><span>Height</span><span className="field-value">{img.height}</span></div>
          <input type="range" min={100} max={4000} step={50} value={img.height} onChange={e => handleUpdateImage({ height: Number(e.target.value) })} />
        </div>
        <div className="field">
          <div className="field-between"><span>Opacity</span><span className="field-value">{Math.round(img.opacity * 100)}%</span></div>
          <input type="range" min={0.1} max={1} step={0.1} value={img.opacity} onChange={e => handleUpdateImage({ opacity: Number(e.target.value) })} />
        </div>
        <label className="field-row"><span>Locked</span>
          <input type="checkbox" className="switch" checked={img.locked} onChange={e => handleUpdateImage({ locked: e.target.checked })} />
        </label>
        <DeleteButton label="Delete image" disabled={img.locked} why="Unlock the image to delete it." />
      </aside>
    );
  }

  return null;
}
