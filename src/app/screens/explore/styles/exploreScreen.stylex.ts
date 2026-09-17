import * as stylex from '@stylexjs/stylex';

const mobile = '@media (max-width: 640px)';

/** StyleX rules for the Explore screen shell (the result count + share grid). */
export const styles = stylex.create({
  /**
   * Quiet count line above the grid. It reports what is actually rendered for
   * the committed `q`/`sort`, so it is the honest answer to "how many are
   * there?" — the hub fetches a single page (see the plan §3.2).
   */
  resultCount: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    margin: '0 0 12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
    [mobile]: {
      gridTemplateColumns: '1fr',
    },
  },
});
