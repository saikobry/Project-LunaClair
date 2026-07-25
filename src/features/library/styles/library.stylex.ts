import * as stylex from '@stylexjs/stylex';

/**
 * Design tokens aligned with the existing app palette.
 */
const colors = {
  accent: '#6366f1',
  accentLight: '#eef2ff',
  textPrimary: '#08060d',
  textSecondary: '#6b6375',
  textMuted: '#9ca3af',
  bgPrimary: '#ffffff',
  bgSecondary: '#f9fafb',
  border: '#e5e4e7',
  danger: '#dc2626',
  dangerLight: '#fef2f2',
  shadow: 'rgba(0,0,0,0.06)',
};

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const slideUp = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(8px) scale(0.97)' },
  to: { opacity: 1, transform: 'translateY(0) scale(1)' },
});

export const styles = stylex.create({
  // === Layout ===
  screen: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '32px',
    maxWidth: 960,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },

  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  title: {
    fontSize: 28,
    fontWeight: 600,
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.5px',
  },

  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    margin: 0,
  },

  // === New Material Button ===
  newButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: colors.accent,
    borderStyle: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
    ':hover': {
      backgroundColor: '#4f46e5',
      boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
      transform: 'translateY(-1px)',
    },
    ':active': {
      transform: 'translateY(0)',
    },
  },

  // === Grid ===
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },

  // === Card ===
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: `0 1px 3px ${colors.shadow}`,
    ':hover': {
      borderColor: colors.accent,
      boxShadow: '0 4px 16px rgba(99,102,241,0.12)',
      transform: 'translateY(-2px)',
    },
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.textPrimary,
    margin: 0,
    lineHeight: 1.3,
    flex: 1,
  },

  cardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    margin: 0,
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },

  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: colors.textMuted,
  },

  cardActions: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  },

  cardActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    cursor: 'pointer',
    color: colors.textSecondary,
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: colors.bgSecondary,
      color: colors.textPrimary,
    },
  },

  cardActionBtnDanger: {
    ':hover': {
      backgroundColor: colors.dangerLight,
      color: colors.danger,
      borderColor: colors.danger,
    },
  },

  sourceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: colors.accent,
    backgroundColor: colors.accentLight,
    borderRadius: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },

  // === Empty State ===
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 32px',
    textAlign: 'center',
    gap: 12,
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
    opacity: 0.3,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: colors.textPrimary,
    margin: 0,
  },

  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    margin: 0,
    maxWidth: 360,
    lineHeight: 1.5,
  },

  // === Modal ===
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    animationName: fadeIn,
    animationDuration: '0.15s',
    animationTimingFunction: 'ease-out',
  },

  modal: {
    backgroundColor: colors.bgPrimary,
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    padding: 28,
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    animationName: slideUp,
    animationDuration: '0.2s',
    animationTimingFunction: 'ease-out',
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: colors.textPrimary,
    margin: 0,
  },

  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    margin: 0,
    lineHeight: 1.5,
  },

  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },

  // === Form ===
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  label: {
    fontSize: 13,
    fontWeight: 600,
    color: colors.textSecondary,
  },

  input: {
    padding: '10px 14px',
    fontSize: 14,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.textPrimary,
    backgroundColor: colors.bgPrimary,
    outlineStyle: 'none',
    transition: 'border-color 0.15s ease',
    ':focus': {
      borderColor: colors.accent,
      boxShadow: '0 0 0 3px rgba(99,102,241,0.1)',
    },
    '::placeholder': {
      color: colors.textMuted,
    },
  },

  textarea: {
    padding: '10px 14px',
    fontSize: 14,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.textPrimary,
    backgroundColor: colors.bgPrimary,
    outlineStyle: 'none',
    resize: 'vertical',
    minHeight: 60,
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
    ':focus': {
      borderColor: colors.accent,
      boxShadow: '0 0 0 3px rgba(99,102,241,0.1)',
    },
  },

  // === Buttons ===
  btnPrimary: {
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: colors.accent,
    borderStyle: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: '#4f46e5',
    },
    ':active': {
      transform: 'scale(0.97)',
    },
  },

  btnSecondary: {
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    color: colors.textSecondary,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: colors.bgSecondary,
      color: colors.textPrimary,
    },
  },

  btnDanger: {
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: colors.danger,
    borderStyle: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: '#b91c1c',
    },
    ':active': {
      transform: 'scale(0.97)',
    },
  },
});
