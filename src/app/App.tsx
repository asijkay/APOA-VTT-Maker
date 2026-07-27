import { useCallback, useRef, useState } from 'react';
import VttViewport from '@/ui/VttViewport';
import DebugHud from '@/ui/DebugHud';
import Toolbar from '@/ui/Toolbar';
import type { DebugStats } from '@/vtt/engine/VttEngine';
import type { EditorTool } from '@/vtt/scene/SceneTypes';
import type { VttEngine } from '@/vtt/engine/VttEngine';

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
  const engineRef = useRef<VttEngine | null>(null);

  const handleDebug = useCallback((s: DebugStats) => { setStats(s); }, []);
  const handleToolChange = useCallback((tool: EditorTool) => { setActiveTool(tool); }, []);

  return (
    <div className="app-shell">
      <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />
      <VttViewport
        onDebugUpdate={handleDebug}
        activeTool={activeTool}
        onActiveToolChange={handleToolChange}
        engineRef={engineRef}
      />
      <DebugHud stats={stats} />
    </div>
  );
}
