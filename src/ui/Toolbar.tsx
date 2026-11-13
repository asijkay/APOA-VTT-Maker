import { Fragment } from 'react';
import type { EditorTool } from '@/vtt/scene/SceneTypes';
import {
  MousePointer2,
  Square,
  Eraser,
  BrickWall,
  DoorClosed,
  AppWindow,
  Flame,
  User,
  Image as ImageIcon,
  Ruler,
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
};

/** Tools are grouped by what they do; a thin rule separates the groups. */
const GROUPS: ToolSpec[][] = [
  [{ id: 'select', label: 'Select', hotkey: 'V', icon: MousePointer2 }],
  [
    { id: 'floor', label: 'Floor', hotkey: 'F', icon: Square },
    { id: 'erase-floor', label: 'Erase floor', hotkey: 'E', icon: Eraser },
  ],
  [
    { id: 'wall', label: 'Wall', hotkey: 'W', icon: BrickWall },
    { id: 'door', label: 'Door', hotkey: 'D', icon: DoorClosed },
    { id: 'window', label: 'Window', hotkey: 'I', icon: AppWindow },
  ],
  [
    { id: 'light', label: 'Light', hotkey: 'L', icon: Flame },
    { id: 'token', label: 'Token', hotkey: 'T', icon: User },
    { id: 'image', label: 'Map image', hotkey: 'M', icon: ImageIcon },
  ],
  [{ id: 'ruler', label: 'Ruler', hotkey: 'R', icon: Ruler }],
];

export default function Toolbar({ activeTool, onToolChange }: Props) {
  return (
    <nav className="panel toolbar" role="toolbar" aria-label="Editor tools">
      {GROUPS.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <div className="tool-sep" role="separator" />}
          {group.map((t) => {
            const isActive = t.id === activeTool;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`tool-btn${isActive ? ' is-active' : ''}`}
                onClick={() => onToolChange(t.id)}
                aria-pressed={isActive}
                aria-label={`${t.label} (${t.hotkey})`}
                data-tip={`${t.label} · ${t.hotkey}`}
              >
                <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
              </button>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
}
