import * as stylex from '@stylexjs/stylex';

const fadeSlideIn = stylex.keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(-4px)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

export const cardStyles = stylex.create({
  interactive: {
    cursor: 'pointer',
    position: 'relative',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    ':hover': {
      transform: 'translateY(-2px)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  clickableArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    userSelect: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  description: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--color-text-disabled)',
  },
  actionBar: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginTop: 4,
  },

  // === Glassmorphic Dropdown Popup ===
  menuPopup: {
    position: 'absolute',
    top: 36,
    right: 0,
    minWidth: 150,
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(229,228,231,0.7)',
    borderRadius: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.12)',
    zIndex: 100,
    padding: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    animationName: fadeSlideIn,
    animationDuration: '0.15s',
    animationTimingFunction: 'ease-out',
  },
});
