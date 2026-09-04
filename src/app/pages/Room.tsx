import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import VttViewport from '@/ui/VttViewport';
import DebugHud from '@/ui/DebugHud';
import Toolbar from '@/ui/Toolbar';
import PropertiesPanel from '@/ui/PropertiesPanel';
import type { DebugStats } from '@/vtt/engine/VttEngine';
import type { EditorTool } from '@/vtt/scene/SceneTypes';
import type { VttEngine } from '@/vtt/engine/VttEngine';
import { loadTestRoom } from '@/vtt/scene/TestRooms';

const DEFAULT_STATS: DebugStats = {
  cameraX: 0,
  cameraY: 0,
  zoom: 1,
  mouseWorldX: 0,
  mouseWorldY: 0,
};

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  
  const [stats, setStats] = useState<DebugStats>(DEFAULT_STATS);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [sceneVersion, setSceneVersion] = useState(0);
  const [debugVision, setDebugVision] = useState(false);
  const [debugCollision, setDebugCollision] = useState(false);
  const [viewMode, setViewMode] = useState<'gm' | 'player'>(roleParam === 'gm' ? 'gm' : 'player');
  const [snapTokens, setSnapTokens] = useState(true);
  const engineRef = useRef<VttEngine | null>(null);

  const handleDebug = useCallback((s: DebugStats) => { setStats(s); }, []);
  const handleToolChange = useCallback((tool: EditorTool) => { setActiveTool(tool); }, []);
  const handleSelectionChange = useCallback((ids: ReadonlySet<string>) => { setSelectedIds(ids); }, []);
  const handleSceneChange = useCallback(() => { setSceneVersion((v) => v + 1); }, []);

  // Sync debug options
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDebugOptions({ showVision: debugVision, showCollision: debugCollision });
      (window as any).__engine = engineRef.current;
    }
  }, [debugVision, debugCollision]);

  // Sync GM/Player view mode
  useEffect(() => {
    engineRef.current?.setViewMode(viewMode);
  }, [viewMode]);

  // Sync snap-to-grid
  useEffect(() => {
    engineRef.current?.setSnapTokens(snapTokens);
  }, [snapTokens]);

  // Global Ctrl+Z / Ctrl+Y shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) engineRef.current.redo();
        else engineRef.current.undo();
        e.preventDefault();
      } else if (e.key === 'y' || e.key === 'Y') {
        engineRef.current.redo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleNewScene = () => {
    if (window.confirm('Start a new scene? All unsaved changes will be lost.')) {
      engineRef.current?.newScene();
      setSelectedIds(new Set());
    }
  };

  const btnStyle: React.CSSProperties = {
    padding: '3px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)',
    color: '#d6dbe2', whiteSpace: 'nowrap',
  };
  const activeBtn: React.CSSProperties = {
    ...btnStyle, background: 'rgba(99,179,237,0.25)',
    borderColor: 'rgba(99,179,237,0.6)', color: '#90cdf4',
  };
  const dangerBtn: React.CSSProperties = {
    ...btnStyle, borderColor: 'rgba(252,129,129,0.4)', color: '#fc8181',
  };

  return (
    <div className="app-shell">
      {viewMode === 'gm' && <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />}

      {/* Bottom-left control panel */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 10,
        background: 'rgba(18, 22, 28, 0.90)', padding: 10, borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.08)', color: '#d6dbe2',
        fontSize: 12, display: 'flex', flexDirection: 'column', gap: 7,
        backdropFilter: 'blur(6px)', minWidth: 170,
      }}>
        
        {/* Room Info */}
        <div style={{ marginBottom: 4, color: '#90cdf4', fontWeight: 'bold' }}>
          Room: {roomId}
        </div>

        {/* View mode */}
        <button
          style={viewMode === 'gm' ? activeBtn : btnStyle}
          onClick={() => setViewMode(m => m === 'gm' ? 'player' : 'gm')}
        >
          {viewMode === 'gm' ? '👁 GM View' : '🎭 Player View'}
        </button>

        {/* Save / Load / New */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={btnStyle} onClick={() => engineRef.current?.saveToFile()}>💾 Save</button>
          <button style={btnStyle} onClick={() => engineRef.current?.loadFromFile()}>📂 Load</button>
          <button style={dangerBtn} onClick={handleNewScene}>🗑</button>
        </div>

        {/* Snap to grid */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={snapTokens}
            onChange={e => setSnapTokens(e.target.checked)} />
          Snap tokens to grid
        </label>

        {/* Debug */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={debugVision}
            onChange={e => setDebugVision(e.target.checked)} />
          Debug Vision
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={debugCollision}
            onChange={e => setDebugCollision(e.target.checked)} />
          Debug Collision
        </label>

        {/* Test rooms */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={btnStyle} onClick={() => { if (engineRef.current) loadTestRoom(engineRef.current.getScene(), 1); }}>Room 1</button>
          <button style={btnStyle} onClick={() => { if (engineRef.current) loadTestRoom(engineRef.current.getScene(), 2); }}>Room 2</button>
        </div>

        {/* Version */}
        <div style={{ marginTop: 2, color: '#4a5568', fontSize: 10, textAlign: 'right', userSelect: 'none' }}>
          {/* @ts-ignore - __APP_VERSION__ is defined by Vite */}
          v{__APP_VERSION__}
        </div>
      </div>

      <VttViewport
        onDebugUpdate={handleDebug}
        activeTool={activeTool}
        onActiveToolChange={handleToolChange}
        onSelectionChange={handleSelectionChange}
        onSceneChange={handleSceneChange}
        engineRef={engineRef}
      />

      {viewMode === 'gm' && engineRef.current && (
        <PropertiesPanel
          selectedIds={selectedIds}
          engine={engineRef.current}
          sceneVersion={sceneVersion}
        />
      )}

      <DebugHud stats={stats} />
    </div>
  );
}
