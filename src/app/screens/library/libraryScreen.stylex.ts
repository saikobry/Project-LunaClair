import * as stylex from '@stylexjs/stylex';

export const screenStyles = stylex.create({
  /** Overview | Collections | Materials switcher — one group, mutually exclusive. */
  viewSwitcher: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: 3,
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
  },
  viewOption: {
    padding: '6px 14px',
    borderRadius: 8,
    borderWidth: 0,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.15s, color 0.15s',
    ':hover': {
      color: 'var(--color-text-primary)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  viewOptionActive: {
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-text-primary)',
  },
  /** Minimal centered stepper footer under a capped overview preview. */
  stepper: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  stepperCount: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-background-muted)',
    borderRadius: 999,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 10,
    paddingRight: 10,
    whiteSpace: 'nowrap',
  },
  /** Accent text action (Show more / Show less) — underline on hover only. */
  stepperAction: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-accent)',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    ':hover': {
      textDecoration: 'underline',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  stepperLink: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    textDecoration: 'underline',
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    ':hover': {
      color: 'var(--color-text-primary)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  /** Collection search narrows the shelf without touching the materials grid. */
  collectionSearch: {
    marginBottom: 16,
    maxWidth: 480,
  },
});
