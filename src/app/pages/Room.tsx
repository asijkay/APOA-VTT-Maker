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

import { NetworkService } from '@/vtt/network/NetworkService';

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
  const networkRef = useRef<NetworkService | null>(null);
  const [networkStatus, setNetworkStatus] = useState('Disconnected');

  const handleDebug = useCallback((s: DebugStats) => { setStats(s); }, []);
  const handleToolChange = useCallback((tool: EditorTool) => { setActiveTool(tool); }, []);
  const handleSelectionChange = useCallback((ids: ReadonlySet<string>) => { setSelectedIds(ids); }, []);
  const handleSceneChange = useCallback(() => { setSceneVersion((v) => v + 1); }, []);
  const handleEphemeralEvent = useCallback((event: any) => {
    if (networkRef.current) {
      networkRef.current.broadcastEphemeral(event);
    }
  }, []);

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

  const handleEngineReady = (engine: VttEngine) => {
    engineRef.current = engine;
    
    // Setup network once engine is ready
    if (!networkRef.current && roomId) {
      const store = engine.getScene();
      const ephemeralStore = engine.getEphemeralStore();
      const network = new NetworkService(roomId, store, ephemeralStore);
      network.onStatusChange = (status) => {
        setNetworkStatus(status);
        if (network.peer?.id) {
          engineRef.current?.setLocalPeerId(network.peer.id);
        }
      };
      network.init();
      networkRef.current = network;
    }
  };



  return (
    <div className="app-shell">
      {viewMode === 'gm' && <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />}

      {/* Bottom-left control panel */}
      <div className="properties-panel glass-panel" style={{
        position: 'absolute', bottom: 16, left: 16, top: 'auto', right: 'auto',
        minWidth: 200, padding: 12, gap: 12
      }}>
        
        {/* Room Info */}
        <div style={{ marginBottom: 2 }}>
          <span style={{ color: 'var(--color-primary-hover)', fontWeight: 'bold' }}>Room: {roomId}</span>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 10, marginTop: 4 }}>
            {networkStatus}
          </div>
        </div>
        
        {/* Invite Links */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary" style={{ flex: 1, padding: '4px 8px' }} onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('role');
            navigator.clipboard.writeText(url.toString());
            alert('Player Invite Link Copied!');
          }}>📋 Player Link</button>
          
          <button className="btn btn-secondary" style={{ flex: 1, padding: '4px 8px' }} onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('role', 'gm');
            navigator.clipboard.writeText(url.toString());
            alert('GM Invite Link Copied!');
          }}>📋 GM Link</button>
        </div>

        {/* View mode */}
        <button
          className={`btn ${viewMode === 'gm' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            const nextMode = viewMode === 'gm' ? 'player' : 'gm';
            if (nextMode === 'player') setActiveTool('select');
            setViewMode(nextMode);
          }}
        >
          {viewMode === 'gm' ? '👁 GM View' : '🎭 Player View'}
        </button>

        {/* Save / Load / New */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => engineRef.current?.saveToFile()}>💾 Save</button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => engineRef.current?.loadFromFile()}>📂 Load</button>
          <button className="btn btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={handleNewScene}>🗑</button>
        </div>

        {/* Snap to grid */}
        <label className="prop-row row-between">
          <input type="checkbox" checked={snapTokens}
            onChange={e => setSnapTokens(e.target.checked)} />
          Snap tokens to grid
        </label>

        {/* Debug */}
        <label className="prop-row row-between">
          <input type="checkbox" checked={debugVision}
            onChange={e => setDebugVision(e.target.checked)} />
          Debug Vision
        </label>
        <label className="prop-row row-between">
          <input type="checkbox" checked={debugCollision}
            onChange={e => setDebugCollision(e.target.checked)} />
          Debug Collision
        </label>

        {/* Test rooms */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { if (engineRef.current) loadTestRoom(engineRef.current.getScene(), 1); }}>Room 1</button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { if (engineRef.current) loadTestRoom(engineRef.current.getScene(), 2); }}>Room 2</button>
        </div>

        {/* Version */}
        <div style={{ color: 'var(--color-text-muted)', fontSize: 10, textAlign: 'right', userSelect: 'none' }}>
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
        onEphemeralEvent={handleEphemeralEvent}
        engineRef={engineRef}
        onEngineReady={handleEngineReady}
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
