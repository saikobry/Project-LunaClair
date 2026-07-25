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
};

export const styles = stylex.create({
  // === Grid ===
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },

  // === Card Internal Layout ===
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

  // === Shared Modal Layout ===
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

  // === Shared Form Fields ===
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

  textarea: {
    padding: '10px 14px',
    fontSize: 14,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e4e7',
    borderRadius: 8,
    color: '#08060d',
    backgroundColor: '#ffffff',
    outlineStyle: 'none',
    resize: 'vertical',
    minHeight: 60,
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
    ':focus': {
      borderColor: '#6366f1',
      boxShadow: '0 0 0 3px rgba(99,102,241,0.1)',
    },
  },
});
