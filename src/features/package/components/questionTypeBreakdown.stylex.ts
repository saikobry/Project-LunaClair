import * as stylex from '@stylexjs/stylex';

/** StyleX rules for `QuestionTypeBreakdown` (canonicalizes the two copies). */
export const questionTypeBreakdownStyles = stylex.create({
  card: {
    backgroundColor: 'var(--color-background-surface)',
    borderRadius: 14,
    border: '1px solid var(--color-border)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  badgesList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 6,
    backgroundColor: 'var(--color-background-muted)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
  },
  /** `chrome="none"` overrides: the host owns its own card, so the breakdown
   * renders as a plain stacked section there. */
  noChromeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  noChromeBadge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '3px 8px',
    borderRadius: 6,
    backgroundColor: 'var(--color-background-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
  },
});
