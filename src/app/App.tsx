import { useCallback, useState } from 'react';
import VttViewport from '@/ui/VttViewport';
import DebugHud from '@/ui/DebugHud';
import type { DebugStats } from '@/vtt/engine/VttEngine';

const DEFAULT_STATS: DebugStats = {
  cameraX: 0,
  cameraY: 0,
  zoom: 1,
  mouseWorldX: 0,
  mouseWorldY: 0,
};

export default function App() {
  const [stats, setStats] = useState<DebugStats>(DEFAULT_STATS);
  const handleDebug = useCallback((s: DebugStats) => setStats(s), []);

  return (
    <div className="app-shell">
      <VttViewport onDebugUpdate={handleDebug} />
      <DebugHud stats={stats} />
    </div>
  );
}
