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
  const engineRef = useRef<VttEngine | null>(null);

  const handleDebug = useCallback((s: DebugStats) => { setStats(s); }, []);
  const handleToolChange = useCallback((tool: EditorTool) => { setActiveTool(tool); }, []);
  const handleSelectionChange = useCallback((id: string | null) => { setSelectedId(id); }, []);
  const handleSceneChange = useCallback(() => { setSceneVersion((v) => v + 1); }, []);

  // Sync debug options when they change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDebugOptions({ showVision: debugVision, showCollision: debugCollision });
      // Expose to window for Playwright E2E testing
      (window as any).__engine = engineRef.current;
    }
  }, [debugVision, debugCollision]);

  return (
    <div className="app-shell">
      <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />
      
      <div className="debug-toggles" style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, background: 'rgba(18, 22, 28, 0.88)', padding: 8, borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.08)', color: '#d6dbe2', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, backdropFilter: 'blur(6px)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={debugVision} onChange={(e) => setDebugVision(e.target.checked)} />
          Debug Vision
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={debugCollision} onChange={(e) => setDebugCollision(e.target.checked)} />
          Debug Collision
        </label>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <button style={{ padding: '2px 6px' }} onClick={() => { if (engineRef.current) loadTestRoom(engineRef.current.getScene(), 1) }}>Room 1</button>
          <button style={{ padding: '2px 6px' }} onClick={() => { if (engineRef.current) loadTestRoom(engineRef.current.getScene(), 2) }}>Room 2</button>
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
