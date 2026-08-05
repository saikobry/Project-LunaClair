import { useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Trash2, X } from 'lucide-react';
import type { HighlightColor } from '../../../domain/reader';
import { IconButton } from '../../../shared/ui/IconButton';
import { HIGHLIGHT_COLORS } from '../constants/annotationDefaults';

const styles = stylex.create({
  popover: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    padding: 4,
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  colorSelectors: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: 2,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    padding: 0,
    transition: 'transform 0.15s ease',
    ':hover': {
      transform: 'scale(1.2)',
    },
  },
  // Dark-popover overrides for ghost IconButtons (the neutral theme's ghost
  // text color is dark and would be unreadable on the dark surface).
  popoverAction: {
    color: '#9ca3af',
    borderRadius: 6,
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: '#f3f4f6',
    },
  },
  // High-contrast destructive action: red tinted shell that reads clearly
  // against the dark bubble.
  popoverDelete: {
    color: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderRadius: 6,
    ':hover': {
      backgroundColor: 'rgba(248, 113, 113, 0.3)',
      color: '#f87171',
    },
  },
  arrow: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    transform: 'translateX(-50%) rotate(45deg)',
    width: 8,
    height: 8,
    backgroundColor: '#1f2937',
  },
});

interface SelectionPopoverProps {
  x: number;
  y: number;
  visible: boolean;
  onSelectColor: (color: HighlightColor) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function SelectionPopover({
  x,
  y,
  visible,
  onSelectColor,
  onDelete,
  onClose,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Springy entrance — GSAP owns scale/alpha (replaces the CSS keyframes).
  // The component remounts whenever it becomes visible, so this runs fresh
  // each time the popover opens.
  useGSAP(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    gsap.fromTo(
      popover,
      { scale: 0.9, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 0.22, ease: 'back.out(1.7)' },
    );
  }, { scope: popoverRef });

  if (!visible) return null;

  return (
    <div
      ref={popoverRef}
      {...stylex.props(styles.popover)}
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
      <div {...stylex.props(styles.content)}>
        {/* Color pickers */}
        <div {...stylex.props(styles.colorSelectors)}>
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.name}
              type="button"
              {...stylex.props(styles.colorDot)}
              style={{ backgroundColor: color.hex }}
              onClick={() => onSelectColor(color.name)}
              title={`Highlight ${color.label}`}
              aria-label={`Highlight ${color.label}`}
            />
          ))}
        </div>

        {/* Delete option if it's an existing highlight */}
        {onDelete && (
          <IconButton
            variant="ghost"
            size="sm"
            label="Remove Highlight"
            tooltip="Remove Highlight"
            icon={<Trash2 size={16} />}
            xstyle={styles.popoverDelete}
            onClick={onDelete}
          />
        )}

        {/* Close popover */}
        <IconButton
          variant="ghost"
          size="sm"
          label="Cancel"
          tooltip="Cancel"
          icon={<X size={16} />}
          xstyle={styles.popoverAction}
          onClick={onClose}
        />
      </div>
      <div {...stylex.props(styles.arrow)} />
    </div>
  );
}
