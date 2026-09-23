import * as stylex from '@stylexjs/stylex';

export const styles = stylex.create({
  // === Grid ===
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },

  // === Shared Modal Layout ===
  modalDescription: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
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
});
