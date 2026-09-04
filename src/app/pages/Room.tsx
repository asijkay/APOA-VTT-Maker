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
  const role = searchParams.get('role') === 'gm' ? 'gm' : 'player';

  const [stats, setStats] = useState<DebugStats>(DEFAULT_STATS);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [sceneVersion, setSceneVersion] = useState(0);
  const [debugVision, setDebugVision] = useState(false);
  const [debugCollision, setDebugCollision] = useState(false);
  const [viewMode, setViewMode] = useState<'gm' | 'player'>(role);
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

  useEffect(() => {
    engineRef.current?.setSnapTokens(snapTokens);
  }, [snapTokens]);

  const toggleVision = () => setDebugVision(v => !v);
  const toggleCollision = () => setDebugCollision(v => !v);
  const toggleViewMode = () => setViewMode(v => v === 'gm' ? 'player' : 'gm');
  const toggleSnap = () => setSnapTokens(v => !v);

  const handleClearMap = () => {
    if (!engineRef.current) return;
    engineRef.current.getScene().clear();
    engineRef.current.getScene().addToken({ x: 200, y: 200 });
  };
  
  const handleLoadTestRoom = () => {
    if (!engineRef.current) return;
    loadTestRoom(engineRef.current.getScene());
  };

  return (
    <div className="app-container">
      {viewMode === 'gm' && (
        <Toolbar activeTool={activeTool} onToolChange={handleToolChange} />
      )}
      
      <div className="viewport-container">
        <VttViewport 
          onEngineReady={(engine) => { 
            engineRef.current = engine; 
            engine.setViewMode(viewMode);
            engine.setSnapTokens(snapTokens);
          }}
          activeTool={activeTool}
          onDebugStats={handleDebug}
          onSelectionChange={handleSelectionChange}
          onSceneChange={handleSceneChange}
        />
        <DebugHud 
          stats={stats} 
          debugVision={debugVision}
          debugCollision={debugCollision}
          viewMode={viewMode}
          snapTokens={snapTokens}
          onToggleVision={toggleVision}
          onToggleCollision={toggleCollision}
          onToggleViewMode={toggleViewMode}
          onToggleSnap={toggleSnap}
          onClearMap={handleClearMap}
          onLoadTestRoom={handleLoadTestRoom}
        />
      </div>

      {viewMode === 'gm' && engineRef.current && (
        <PropertiesPanel 
          engine={engineRef.current} 
          selectedIds={selectedIds} 
          sceneVersion={sceneVersion} 
        />
      )}
      
      <div style={{
        position: 'absolute',
        top: 10,
        left: 200,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '5px 10px',
        color: 'white',
        borderRadius: 4,
        fontSize: '12px',
        pointerEvents: 'none'
      }}>
        Room: {roomId}
      </div>
    </div>
  );
}
