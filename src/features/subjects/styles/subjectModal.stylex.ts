import * as stylex from '@stylexjs/stylex';

export const styles = stylex.create({
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

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
  },

  textarea: {
    padding: '10px 14px',
    fontSize: 14,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-background-surface)',
    outlineStyle: 'none',
    resize: 'vertical',
    minHeight: 60,
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
    ':focus': {
      borderColor: 'var(--color-accent)',
      boxShadow: '0 0 0 3px var(--color-overlay-hover)',
    },
  },
});
