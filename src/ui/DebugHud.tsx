import type { DebugStats } from '@/vtt/engine/VttEngine';

type Props = {
  stats: DebugStats;
};

function fmt(n: number, digits: number = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

export default function DebugHud({ stats }: Props) {
  return (
    <div className="debug-hud" aria-label="Debug HUD">
      <div className="row">
        <span className="label">camera.x</span>
        <span className="value">{fmt(stats.cameraX)}</span>
      </div>
      <div className="row">
        <span className="label">camera.y</span>
        <span className="value">{fmt(stats.cameraY)}</span>
      </div>
      <div className="row">
        <span className="label">zoom</span>
        <span className="value">{fmt(stats.zoom, 3)}x</span>
      </div>
      <div className="row">
        <span className="label">mouse.wx</span>
        <span className="value">{fmt(stats.mouseWorldX)}</span>
      </div>
      <div className="row">
        <span className="label">mouse.wy</span>
        <span className="value">{fmt(stats.mouseWorldY)}</span>
      </div>
    </div>
  );
}
