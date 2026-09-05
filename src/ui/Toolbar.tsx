import type { EditorTool } from '@/vtt/scene/SceneTypes';
import { 
  MousePointer2, 
  Square, 
  Eraser, 
  Minus, 
  DoorClosed, 
  AppWindow, 
  Lightbulb, 
  User, 
  Image as ImageIcon, 
  Ruler 
} from 'lucide-react';

type Props = {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
};

type ToolSpec = {
  id: EditorTool;
  label: string;
  hotkey: string;
  icon: React.ElementType;
  enabled: boolean;
};

const TOOLS: ToolSpec[] = [
  { id: 'select', label: 'Select', hotkey: 'V', icon: MousePointer2, enabled: true },
  { id: 'floor', label: 'Floor', hotkey: 'F', icon: Square, enabled: true },
  { id: 'erase-floor', label: 'Erase', hotkey: 'E', icon: Eraser, enabled: true },
  { id: 'wall', label: 'Wall', hotkey: 'W', icon: Minus, enabled: true },
  { id: 'door', label: 'Door', hotkey: 'D', icon: DoorClosed, enabled: true },
  { id: 'window', label: 'Window', hotkey: 'I', icon: AppWindow, enabled: true },
  { id: 'light', label: 'Light', hotkey: 'L', icon: Lightbulb, enabled: true },
  { id: 'token', label: 'Token', hotkey: 'T', icon: User, enabled: true },
  { id: 'image', label: 'Image', hotkey: 'M', icon: ImageIcon, enabled: true },
  { id: 'ruler', label: 'Ruler', hotkey: 'R', icon: Ruler, enabled: true },
];

export default function Toolbar({ activeTool, onToolChange }: Props) {
  return (
    <div className="toolbar glass-panel" role="toolbar" aria-label="Editor tools">
      {TOOLS.map((t) => {
        const isActive = t.id === activeTool;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            className={`tool-btn${isActive ? ' is-active' : ''}${t.enabled ? '' : ' is-disabled'}`}
            onClick={() => t.enabled && onToolChange(t.id)}
            aria-pressed={isActive}
            aria-label={`${t.label}${t.enabled ? '' : ' (coming in later milestone)'}`}
            disabled={!t.enabled}
            title={`${t.label} (${t.hotkey})`}
          >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="tool-icon" />
            <span className="tool-hotkey">{t.hotkey}</span>
          </button>
        );
      })}
    </div>
  );
}
