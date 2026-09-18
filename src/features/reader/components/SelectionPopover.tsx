import { useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Trash2, X, Sparkles, Wand2, Lightbulb } from 'lucide-react';
import type { HighlightColor } from '../../../domain/reader/models/annotation.types';
import { IconButton } from '../../../shared/ui/IconButton/IconButton';
import { HIGHLIGHT_COLORS } from '../constants/annotationDefaults';

const styles = stylex.create({
  dock: {
    position: 'sticky',
    top: 48,
    zIndex: 60,
    height: 0,
    overflow: 'visible',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingRight: 20,
    pointerEvents: 'none',
  },
  toolbar: {
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column', // Stack vertically
    alignItems: 'center',
    gap: 8,
    padding: '10px 6px',
    backgroundColor: 'var(--color-background-inverted)',
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'color-mix(in srgb, var(--color-on-dark) 14%, transparent)',
    userSelect: 'none',
  },
  colorGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 7,
    margin: 0,
    padding: 0,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'transparent',
    cursor: 'pointer',
    padding: 0,
    margin: 0,
    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-on-dark) 35%, transparent)',
    transition: 'transform 0.12s ease, border-color 0.12s ease',
    ':hover': {
      transform: 'scale(1.1)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: 2,
    },
  },

  /* Horizontal dividers between vertical groups */
  divider: {
    width: 18,
    height: 1,
    backgroundColor: 'color-mix(in srgb, var(--color-on-dark) 12%, transparent)',
    flexShrink: 0,
    margin: '2px 0',
  },

  /* Shared IconButton overrides — preserve the rail's exact geometry and
     wash treatments over the ghost base. */
  aiGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    margin: 0,
    padding: 0,
  },
  railAiBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'transparent',
    ':hover': {
      backgroundColor: 'color-mix(in srgb, var(--color-on-dark) 10%, transparent)',
    },
    ':active': {
      transform: 'scale(0.92)',
    },
  },

  /* Action buttons (Delete / Close) */
  actionGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    margin: 0,
    padding: 0,
  },
  railDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    backgroundColor: 'transparent',
    color: 'var(--color-error)',
    ':hover': {
      backgroundColor: 'color-mix(in srgb, var(--color-error) 15%, transparent)',
      color: 'color-mix(in srgb, var(--color-error) 75%, white)',
    },
  },
  railCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    backgroundColor: 'transparent',
    color: 'var(--color-text-disabled)',
    ':hover': {
      backgroundColor: 'color-mix(in srgb, var(--color-on-dark) 10%, transparent)',
      color: 'var(--color-on-dark)',
    },
  },
});

interface SelectionRailProps {
  visible: boolean;
  onSelectColor: (color: HighlightColor) => void;
  onDelete?: () => void;
  onClose: () => void;
  onAskAi?: (action: 'explain' | 'simplify' | 'example') => void;
}

export default function SelectionPopover({
  visible,
  onSelectColor,
  onDelete,
  onClose,
  onAskAi,
}: SelectionRailProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!visible || !toolbarRef.current) return;

      // Animate smoothly from the right side
      gsap.fromTo(
        toolbarRef.current,
        { x: 20, autoAlpha: 0, scale: 0.9 },
        { x: 0, autoAlpha: 1, scale: 1, duration: 0.24, ease: 'power3.out' },
      );
    },
    { dependencies: [visible] },
  );

  if (!visible) return null;

  return (
    <div {...stylex.props(styles.dock)}>
      <div
        ref={toolbarRef}
        {...stylex.props(styles.toolbar)}
        role="toolbar"
        aria-label="Selection actions"
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* Color Palette */}
        <div {...stylex.props(styles.colorGroup)}>
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

        {/* AI Actions */}
        {onAskAi && (
          <>
            <div {...stylex.props(styles.divider)} aria-hidden="true" />
            <div {...stylex.props(styles.aiGroup)}>
              <IconButton
                label="Explain selected text"
                tooltip="Explain selected text"
                icon={<Sparkles size={16} color="var(--color-accent)" />}
                variant="ghost"
                size="sm"
                xstyle={styles.railAiBtn}
                onClick={() => {
                  onAskAi('explain');
                  onClose();
                }}
              />
              <IconButton
                label="Simplify selected text"
                tooltip="Simplify selected text"
                icon={<Wand2 size={15} color="var(--color-error)" />}
                variant="ghost"
                size="sm"
                xstyle={styles.railAiBtn}
                onClick={() => {
                  onAskAi('simplify');
                  onClose();
                }}
              />
              <IconButton
                label="Provide an example"
                tooltip="Provide an example"
                icon={<Lightbulb size={16} color="var(--color-warning)" />}
                variant="ghost"
                size="sm"
                xstyle={styles.railAiBtn}
                onClick={() => {
                  onAskAi('example');
                  onClose();
                }}
              />
            </div>
          </>
        )}

        {/* Delete & Close */}
        <div {...stylex.props(styles.divider)} aria-hidden="true" />
        <div {...stylex.props(styles.actionGroup)}>
          {onDelete && (
            <IconButton
              label="Remove Highlight"
              tooltip="Remove Highlight"
              icon={
                <span style={{ color: 'var(--color-error)', display: 'inline-flex' }}>
                  <Trash2 size={15} />
                </span>
              }
              variant="ghost"
              size="sm"
              xstyle={styles.railDeleteBtn}
              onClick={onDelete}
            />
          )}
          <IconButton
            label="Cancel"
            tooltip="Cancel"
            icon={
              <span style={{ color: 'var(--color-text-disabled)', display: 'inline-flex' }}>
                <X size={15} />
              </span>
            }
            variant="ghost"
            size="sm"
            xstyle={styles.railCloseBtn}
            onClick={onClose}
          />
        </div>
      </div>
    </div>
  );
}
