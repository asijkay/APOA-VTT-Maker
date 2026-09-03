import type { EditorTool } from '@/vtt/scene/SceneTypes';

type Props = {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
};

type ToolSpec = {
  id: EditorTool;
  label: string;
  hotkey: string;
  enabled: boolean;
};

const TOOLS: ToolSpec[] = [
  { id: 'select', label: 'Select', hotkey: 'V', enabled: true },
  { id: 'floor', label: 'Floor', hotkey: 'F', enabled: true },
  { id: 'erase-floor', label: 'Erase Floor', hotkey: 'E', enabled: true },
  { id: 'wall', label: 'Wall', hotkey: 'W', enabled: true },
  { id: 'door', label: 'Door', hotkey: 'D', enabled: true },
  { id: 'light', label: 'Light', hotkey: 'L', enabled: true },
  { id: 'token', label: 'Token', hotkey: 'T', enabled: true },
];

export default function Toolbar({ activeTool, onToolChange }: Props) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Editor tools">
      {TOOLS.map((t) => {
        const isActive = t.id === activeTool;
        return (
          <button
            key={t.id}
            type="button"
            className={`tool-btn${isActive ? ' is-active' : ''}${t.enabled ? '' : ' is-disabled'}`}
            onClick={() => t.enabled && onToolChange(t.id)}
            aria-pressed={isActive}
            aria-label={`${t.label}${t.enabled ? '' : ' (coming in later milestone)'}`}
            disabled={!t.enabled}
          >
            <span className="tool-label">{t.label}</span>
            <span className="tool-hotkey">{t.hotkey}</span>
          </button>
        );
      })}
      <div className="toolbar-hint">
        <div>Pan: hold <kbd>Space</kbd> + drag / right / middle</div>
        <div>Zoom: <kbd>Scroll</kbd></div>
      </div>
    </div>
  );
}
