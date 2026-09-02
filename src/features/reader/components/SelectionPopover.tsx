import { useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Trash2, X, Sparkles, Lightbulb, BookOpen } from 'lucide-react';
import type { HighlightColor } from '../../../domain/reader/models/annotation.types';
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
  popoverAction: {
    color: '#9ca3af',
    borderRadius: 6,
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: '#f3f4f6',
    },
  },
  popoverAi: {
    color: '#a5b4fc',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 6,
    ':hover': {
      backgroundColor: 'rgba(99, 102, 241, 0.3)',
      color: '#ffffff',
    },
  },
  aiActionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
    borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
  },
  aiActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 7px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#e5e7eb',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'rgba(99, 102, 241, 0.25)',
      color: '#ffffff',
    },
  },
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
  onAskAi?: (action: 'explain' | 'simplify' | 'example') => void;
}

export default function SelectionPopover({
  x,
  y,
  visible,
  onSelectColor,
  onDelete,
  onClose,
  onAskAi,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [showAiMenu, setShowAiMenu] = useState(false);

  // Springy entrance — GSAP owns scale/alpha (replaces the CSS keyframes).
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

        {/* Ask AI Context Actions */}
        {onAskAi && !showAiMenu && (
          <IconButton
            variant="ghost"
            size="sm"
            label="Ask AI"
            tooltip="Ask AI about selection"
            icon={<Sparkles size={15} color="#a5b4fc" />}
            xstyle={styles.popoverAi}
            onClick={() => setShowAiMenu(true)}
          />
        )}

        {onAskAi && showAiMenu && (
          <div {...stylex.props(styles.aiActionsRow)}>
            <button
              type="button"
              onClick={() => {
                onAskAi('explain');
                onClose();
              }}
              {...stylex.props(styles.aiActionBtn)}
              title="Explain selected text in detail"
            >
              <Sparkles size={12} color="#a5b4fc" />
              <span>Explain</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onAskAi('simplify');
                onClose();
              }}
              {...stylex.props(styles.aiActionBtn)}
              title="Simplify selected text"
            >
              <Lightbulb size={12} color="#fde047" />
              <span>Simplify</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onAskAi('example');
                onClose();
              }}
              {...stylex.props(styles.aiActionBtn)}
              title="Provide a practical example"
            >
              <BookOpen size={12} color="#93c5fd" />
              <span>Example</span>
            </button>
          </div>
        )}

        {/* Delete option if it's an existing highlight */}
        {onDelete && (
          <IconButton
            variant="ghost"
            size="sm"
            label="Remove Highlight"
            tooltip="Remove Highlight"
            icon={<Trash2 size={16} color="#f87171" />}
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
          icon={<X size={16} color="#9ca3af" />}
          xstyle={styles.popoverAction}
          onClick={onClose}
        />
      </div>
      <div {...stylex.props(styles.arrow)} />
    </div>
  );
}
