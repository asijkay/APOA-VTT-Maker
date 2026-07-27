import { useEffect, useRef } from 'react';
import { VttEngine, type DebugStats } from '@/vtt/engine/VttEngine';

type Props = {
  onDebugUpdate?: (stats: DebugStats) => void;
};

export default function VttViewport({ onDebugUpdate }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<VttEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;

    (async () => {
      const engine = await VttEngine.create({
        canvas,
        onDebugUpdate,
      });
      if (disposed) {
        engine.destroy();
        return;
      }
      engineRef.current = engine;
      if (onDebugUpdate) onDebugUpdate(engine.getDebugStats());
    })();

    return () => {
      disposed = true;
      const engine = engineRef.current;
      engineRef.current = null;
      if (engine) engine.destroy();
    };
  }, [onDebugUpdate]);

  return (
    <div ref={hostRef} className="viewport-host">
      <canvas ref={canvasRef} aria-label="VTT map viewport" />
    </div>
  );
}
