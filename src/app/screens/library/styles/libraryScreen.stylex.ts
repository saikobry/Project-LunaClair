import * as stylex from '@stylexjs/stylex';

export const screenStyles = stylex.create({
  /** Overview | Collections | Materials switcher — one group, mutually exclusive. */
  /**
   * Layout slot for the shared `SegmentedControl` used by `LibraryViewSwitcher`.
   * The component owns its own chrome; this carries only the screen's spacing.
   */
  viewSwitcherSlot: {
    marginBottom: 24,
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
