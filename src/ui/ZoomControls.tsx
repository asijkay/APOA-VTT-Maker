import { Minus, Plus } from 'lucide-react';

type Props = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export default function ZoomControls({ zoom, onZoomIn, onZoomOut }: Props) {
  return (
    <div className="panel zoom-panel" role="group" aria-label="Zoom">
      <button type="button" className="zoom-btn" aria-label="Zoom out" onClick={onZoomOut}>
        <Minus className="ic-s" aria-hidden="true" />
      </button>
      <span className="zoom-value" aria-live="polite">{Math.round(zoom * 100)}%</span>
      <button type="button" className="zoom-btn" aria-label="Zoom in" onClick={onZoomIn}>
        <Plus className="ic-s" aria-hidden="true" />
      </button>
    </div>
  );
}
