import { useCallback, useEffect, useRef, useState } from 'react';
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

export default function App() {
  const [stats, setStats] = useState<DebugStats>(DEFAULT_STATS);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [debugVision, setDebugVision] = useState(false);
  const [debugCollision, setDebugCollision] = useState(false);
  const [viewMode, setViewMode] = useState<'gm' | 'player'>('gm');
  const engineRef = useRef<VttEngine | null>(null);

  const handleDebug = useCallback((s: DebugStats) => { setStats(s); }, []);
  const handleToolChange = useCallback((tool: EditorTool) => { setActiveTool(tool); }, []);
  const handleSelectionChange = useCallback((id: string | null) => { setSelectedId(id); }, []);
  const handleSceneChange = useCallback(() => { setSceneVersion((v) => v + 1); }, []);

  // Sync debug options when they change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDebugOptions({ showVision: debugVision, showCollision: debugCollision });
      (window as any).__engine = engineRef.current;
    }
  }, [debugVision, debugCollision]);

  // Sync GM/Player view mode
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setViewMode(viewMode);
    }
  }, [viewMode]);

  // Global Ctrl+Z / Ctrl+Y keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          engineRef.current.redo();
        } else {
          engineRef.current.undo();
        }
        e.preventDefault();
      } else if (e.key === 'y' || e.key === 'Y') {
        engineRef.current.redo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const toggleViewMode = () => {
    const newMode = viewMode === 'gm' ? 'player' : 'gm';
    setViewMode(newMode);
  };

  const btnStyle: React.CSSProperties = { padding: '3px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#d6dbe2' };
  const activeBtn: React.CSSProperties = { ...btnStyle, background: 'rgba(99,179,237,0.25)', borderColor: 'rgba(99,179,237,0.6)', color: '#90cdf4' };

  return (
    <div className="app-shell">
      <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />

      {/* Bottom-left control panel */}
      <div className="debug-toggles" style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, background: 'rgba(18, 22, 28, 0.88)', padding: 10, borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.08)', color: '#d6dbe2', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8, backdropFilter: 'blur(6px)', minWidth: 160 }}>
        
        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={viewMode === 'gm' ? activeBtn : btnStyle} onClick={toggleViewMode}>
            {viewMode === 'gm' ? '👁 GM View' : '🎭 Player View'}
          </button>
        </div>

        {/* Save / Load */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={btnStyle} title="Save scene to JSON file" onClick={() => engineRef.current?.saveToFile()}>💾 Save</button>
          <button style={btnStyle} title="Load scene from JSON file" onClick={() => engineRef.current?.loadFromFile()}>📂 Load</button>
        </div>

        {/* Debug toggles */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={debugVision} onChange={(e) => setDebugVision(e.target.checked)} />
          Debug Vision
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={debugCollision} onChange={(e) => setDebugCollision(e.target.checked)} />
          Debug Collision
        </label>

        {/* Test rooms */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={btnStyle} onClick={() => { if (engineRef.current) loadTestRoom(engineRef.current.getScene(), 1) }}>Room 1</button>
          <button style={btnStyle} onClick={() => { if (engineRef.current) loadTestRoom(engineRef.current.getScene(), 2) }}>Room 2</button>
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
      {selectedId && engineRef.current && (
        <PropertiesPanel
          selectedId={selectedId}
          engine={engineRef.current}
          sceneVersion={sceneVersion}
        />
      )}
      <DebugHud stats={stats} />
    </div>
  );
}
