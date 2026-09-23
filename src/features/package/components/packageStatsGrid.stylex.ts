import * as stylex from '@stylexjs/stylex';

/**
 * StyleX rules for `PackageStatsGrid`. Values canonicalize the two call sites:
 * the screen's roomier card (padding 14/16, gap 6, value 22, 680px
 * breakpoint) wins over the modal's tighter copy.
 */
export const packageStatsGridStyles = stylex.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    '@media (max-width: 680px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    padding: '14px 16px',
    backgroundColor: 'var(--color-background-muted)',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    gap: 6,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
  },
});
