import { Trash2 } from 'lucide-react';
import type { HighlightColor } from '../types';

interface SelectionPopoverProps {
  x: number;
  y: number;
  visible: boolean;
  onSelectColor: (color: HighlightColor) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const COLORS: { name: HighlightColor; hex: string; label: string }[] = [
  { name: 'yellow', hex: '#fef08a', label: 'Yellow' },
  { name: 'green', hex: '#bbf7d0', label: 'Green' },
  { name: 'pink', hex: '#fbcfe8', label: 'Pink' },
  { name: 'blue', hex: '#bfdbfe', label: 'Blue' },
];

export default function SelectionPopover({
  x,
  y,
  visible,
  onSelectColor,
  onDelete,
  onClose,
}: SelectionPopoverProps) {
  if (!visible) return null;

  return (
    <div
      className="selection-popover"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        zIndex: 100,
        marginBottom: '8px',
      }}
      // Prevent selection collapse when clicking inside the popover buttons
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="selection-popover-content">
        {/* Color pickers */}
        <div className="color-selectors">
          {COLORS.map((color) => (
            <button
              key={color.name}
              className={`color-dot ${color.name}`}
              onClick={() => onSelectColor(color.name)}
              title={`Highlight ${color.label}`}
              style={{ backgroundColor: color.hex }}
              aria-label={`Highlight ${color.label}`}
            />
          ))}
        </div>

        {/* Delete option if it's an existing highlight */}
        {onDelete && (
          <button
            className="popover-action delete-btn"
            onClick={onDelete}
            title="Remove Highlight"
            aria-label="Remove Highlight"
          >
            <Trash2 size={16} />
          </button>
        )}

        {/* Close popover */}
        <button
          className="popover-action close-btn"
          onClick={onClose}
          title="Cancel"
          aria-label="Cancel"
        >
          &times;
        </button>
      </div>
      <div className="selection-popover-arrow" />
    </div>
  );
}
