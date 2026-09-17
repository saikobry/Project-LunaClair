import * as stylex from '@stylexjs/stylex';

const mobile = '@media (max-width: 640px)';

/** StyleX rules for the Explore filter bar (search + sort). */
export const styles = stylex.create({
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    flexWrap: 'wrap',
    [mobile]: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 10,
    },
  },
  searchField: {
    flex: 1,
    minWidth: 240,
    [mobile]: {
      width: '100%',
      minWidth: 0,
    },
  },
  /**
   * The sort control keeps its natural width while the search field (`flex: 1`)
   * absorbs the squeeze; without this the segments compress before the bar wraps.
   */
  sortControl: {
    flexShrink: 0,
  },
});
