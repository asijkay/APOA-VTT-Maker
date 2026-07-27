import { useEffect, useRef } from 'react';
import { VttEngine, type DebugStats } from '@/vtt/engine/VttEngine';
import type { EditorTool } from '@/vtt/scene/SceneTypes';

type Props = {
  onDebugUpdate?: (stats: DebugStats) => void;
  activeTool: EditorTool;
  onActiveToolChange?: (tool: EditorTool) => void;
  engineRef?: React.MutableRefObject<VttEngine | null>;
};

export default function VttViewport({
  onDebugUpdate,
  activeTool,
  onActiveToolChange,
  engineRef: externalEngineRef,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const internalEngineRef = useRef<VttEngine | null>(null);

  const getEngineRef = () => externalEngineRef ?? internalEngineRef;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    (async () => {
      const engine = await VttEngine.create({
        container: host,
        onDebugUpdate,
        onActiveToolChange,
      });
      if (disposed) {
        engine.destroy();
        return;
      }
      getEngineRef().current = engine;
      if (onDebugUpdate) onDebugUpdate(engine.getDebugStats());
    })();

    return () => {
      disposed = true;
      const engine = getEngineRef().current;
      getEngineRef().current = null;
      if (engine) engine.destroy();
    };
    // Lifetime-only deps on purpose: engine creation is tied to canvas mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = getEngineRef().current;
    if (engine && engine.getActiveTool() !== activeTool) {
      engine.setActiveTool(activeTool);
    }
  }, [activeTool, getEngineRef]);

  return (
    <div ref={hostRef} className="viewport-host" aria-label="VTT map viewport" role="region" />
  );
}
