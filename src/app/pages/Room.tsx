import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import VttViewport from '@/ui/VttViewport';
import DebugHud from '@/ui/DebugHud';
import Toolbar from '@/ui/Toolbar';
import PropertiesPanel from '@/ui/PropertiesPanel';
import TopBar from '@/ui/TopBar';
import PlayersPanel, { MeCard } from '@/ui/PlayersPanel';
import ZoomControls from '@/ui/ZoomControls';
import type { DebugStats } from '@/vtt/engine/VttEngine';
import type { EditorTool } from '@/vtt/scene/SceneTypes';
import type { VttEngine } from '@/vtt/engine/VttEngine';
import { loadTestRoom } from '@/vtt/scene/TestRooms';

import { NetworkService, type RoleInfo } from '@/vtt/network/NetworkService';
import { loadIdentity, resolveGmKey } from '@/vtt/network/identity';
import type { PlayerInfo } from '@/vtt/network/protocol';

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
  const wantsGM = searchParams.get('role') === 'gm';
  const urlKey = searchParams.get('key');
  const identity = useMemo(() => loadIdentity(), []);
  const gmKey = useMemo(
    () => (roomId ? resolveGmKey(roomId, urlKey, wantsGM) : null),
    [roomId, urlKey, wantsGM],
  );
  
  const [stats, setStats] = useState<DebugStats>(DEFAULT_STATS);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [sceneVersion, setSceneVersion] = useState(0);
  const [debugVision, setDebugVision] = useState(false);
  const [debugCollision, setDebugCollision] = useState(false);
  const [viewMode, setViewMode] = useState<'gm' | 'player'>(wantsGM ? 'gm' : 'player');
  // Whether the host actually granted us GM rights. The URL only says what we asked for.
  const [canGM, setCanGM] = useState(gmKey !== null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [snapTokens, setSnapTokens] = useState(true);
  const engineRef = useRef<VttEngine | null>(null);
  const networkRef = useRef<NetworkService | null>(null);
  const [networkStatus, setNetworkStatus] = useState('Disconnected');
  const offline = /^(Disconnected|Waiting for the GM|Host not found|Could not reach|Error|Lost contact|Signalling)/.test(networkStatus);

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
    
    // The view-mode effect above runs on mount, before the engine exists, so apply the initial mode here.
    // (Without this a player who joins via link keeps the engine's default 'gm' mode: no fog, no ownership filter.)
    engine.setViewMode(wantsGM ? 'gm' : 'player');
    engine.setLocalPeerId(identity.id);

    // Setup network once engine is ready
    if (!networkRef.current && roomId) {
      const network = new NetworkService({
        roomId,
        store: engine.getScene(),
        ephemeralStore: engine.getEphemeralStore(),
        identity,
        gmKey,
      });
      network.onStatusChange = setNetworkStatus;
      network.onPlayersChange = setPlayers;
      network.onFogMemory = (cells, replace) => engineRef.current?.mergeFogMemory(cells, replace);
      network.onRoleChange = (role: RoleInfo) => {
        // Only a holder of the GM key can host, so a host is always a GM; a joined client is GM only if the host says so.
        const gm = role.isHost ? true : role.isGM;
        setCanGM(gm);
        if (!gm) {
          setViewMode('player');
          setActiveTool('select');
        }
        engineRef.current?.setLocalPeerId(role.playerId);
        // A client mirrors the host's scene; it must not autosave it over its own.
        engineRef.current?.setAutoSaveEnabled(role.isHost);
      };
      network.init();
      networkRef.current = network;
      (window as any).__network = network; // debug/e2e hook, like __engine
    }
  };

  // Tear the connection down when leaving the room (and on StrictMode's dev re-mount).
  useEffect(() => () => {
    networkRef.current?.destroy();
    networkRef.current = null;
  }, []);

  const editing = canGM && viewMode === 'gm';
  // Live scene data for the side panels (re-read whenever the scene changes).
  void sceneVersion;
  const tokens = engineRef.current ? engineRef.current.getScene().peek().tokens : [];

  const playerLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('role');
    url.searchParams.delete('key'); // never put the GM key in a player link
    return url.toString();
  };
  const gmLink = canGM && gmKey
    ? () => {
        const url = new URL(window.location.href);
        url.searchParams.set('role', 'gm');
        url.searchParams.set('key', gmKey);
        return url.toString();
      }
    : undefined;

  return (
    <div className="app-shell">
      <VttViewport
        roomId={roomId}
        onDebugUpdate={handleDebug}
        activeTool={activeTool}
        onActiveToolChange={handleToolChange}
        onSelectionChange={handleSelectionChange}
        onSceneChange={handleSceneChange}
        onEphemeralEvent={handleEphemeralEvent}
        engineRef={engineRef}
        onEngineReady={handleEngineReady}
      />

      {offline && <div className={`net-banner${editing ? '' : ' is-player'}`} role="status">{networkStatus}</div>}

      {editing && <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />}

      <TopBar
        roomId={roomId ?? ''}
        status={networkStatus}
        playerCount={players.length}
        canGM={canGM}
        viewMode={viewMode}
        onViewMode={(mode) => {
          if (mode === 'player') setActiveTool('select');
          setViewMode(mode);
        }}
        playerLink={playerLink}
        gmLink={gmLink}
        identityId={identity.id}
        version={__APP_VERSION__}
        onSave={() => engineRef.current?.saveToFile()}
        onLoad={() => engineRef.current?.loadFromFile()}
        onClear={handleNewScene}
        onDemo={(n) => { if (engineRef.current) loadTestRoom(engineRef.current.getScene(), n); }}
        snapTokens={snapTokens}
        onSnapTokens={setSnapTokens}
        debugVision={debugVision}
        onDebugVision={setDebugVision}
        debugCollision={debugCollision}
        onDebugCollision={setDebugCollision}
      />

      {editing && engineRef.current && (
        <PropertiesPanel
          selectedIds={selectedIds}
          engine={engineRef.current}
          sceneVersion={sceneVersion}
          players={players}
          selfId={identity.id}
        />
      )}

      {editing
        ? <PlayersPanel players={players} selfId={identity.id} tokens={tokens} />
        : <MeCard selfId={identity.id} tokens={tokens} />}

      <ZoomControls
        zoom={stats.zoom}
        onZoomIn={() => engineRef.current?.zoomBy(1.25)}
        onZoomOut={() => engineRef.current?.zoomBy(1 / 1.25)}
      />

      <div className="hint-bar">
        <kbd>Right-drag</kbd> to pan · <kbd>Scroll</kbd> to zoom ·{' '}
        {editing ? <><kbd>Esc</kbd> cancels the tool</> : <><kbd>Right-click</kbd> pings</>}
      </div>

      {(debugVision || debugCollision) && <DebugHud stats={stats} />}
    </div>
  );
}
