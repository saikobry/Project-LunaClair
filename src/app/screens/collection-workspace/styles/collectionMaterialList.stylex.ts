import * as stylex from '@stylexjs/stylex';

/**
 * StyleX rules for the collection playlist list, extracted per the project's
 * `*.stylex.ts` naming convention so both `CollectionMaterialList` and
 * `CollectionMaterialRow` share one source of truth.
 */
export const styles = stylex.create({
  list: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: {
      default: 8,
      '@media (min-width: 640px)': 12,
    },
    padding: {
      default: '10px 12px',
      '@media (min-width: 640px)': '12px 14px',
    },
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface, #17181d)',
    transition: 'border-color 0.16s, background-color 0.16s',
    ':hover': {
      borderColor: 'var(--color-accent)',
      backgroundColor: 'var(--color-background-muted)',
    },
    WebkitFontSmoothing: 'antialiased',
    userSelect: 'none',
  },
  dragHandle: {
    display: {
      default: 'none',
      '@media (min-width: 640px)': 'flex',
    },
    cursor: 'grab',
    color: 'var(--color-text-secondary)',
    padding: 4,
    userSelect: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    flexShrink: 0,
  },
  stepNumber: {
    display: {
      default: 'none',
      '@media (min-width: 1024px)': 'block',
    },
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    fontFamily: 'monospace',
    fontVariantNumeric: 'tabular-nums',
    width: 20,
    textAlign: 'center',
    flexShrink: 0,
  },
  iconMark: {
    width: {
      default: 34,
      '@media (min-width: 640px)': 40,
    },
    height: {
      default: 34,
      '@media (min-width: 640px)': 40,
    },
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-overlay-hover)',
    color: 'var(--color-accent)',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  title: {
    fontSize: {
      default: 13,
      '@media (min-width: 640px)': 14,
    },
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  titleButton: {
    fontSize: 'inherit',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0,
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'block',
    width: '100%',
    transition: 'color 0.15s ease',
    ':hover': {
      color: 'var(--color-accent)',
    },
  },
  /** Tag pills use the shared neutral `Chip`; the row only wraps them. */
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  masterySection: {
    display: {
      default: 'none',
      '@media (min-width: 1024px)': 'flex',
    },
    alignItems: 'center',
    gap: 8,
    width: 100,
    flexShrink: 0,
  },
  masteryLabel: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    minWidth: 32,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'var(--color-border)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: 'var(--color-accent)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  arrowGroup: {
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 640px)': 'row',
    },
    alignItems: 'center',
  },
  arrowBtn: {
    width: {
      default: 22,
      '@media (min-width: 640px)': 28,
    },
    height: {
      default: 20,
      '@media (min-width: 640px)': 28,
    },
    padding: 0,
    minHeight: 'unset',
  },
  removeBtn: {
    width: {
      default: 24,
      '@media (min-width: 640px)': 28,
    },
    height: {
      default: 24,
      '@media (min-width: 640px)': 28,
    },
    padding: 0,
  },
  holdRing: {
    position: 'absolute',
    pointerEvents: 'none',
    display: 'none',
    zIndex: 999,
    transform: 'translate(-50%, -50%)',
    filter: 'drop-shadow(0 2px 10px rgba(0, 0, 0, 0.5))',
  },
  footer: {
    marginTop: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'var(--color-border)',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13,
    transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      borderColor: 'var(--color-accent)',
      color: 'var(--color-accent)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  footerText: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
});
