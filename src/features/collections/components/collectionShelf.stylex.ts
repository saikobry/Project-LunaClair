import * as stylex from '@stylexjs/stylex';

const tablet = '@media (min-width: 641px)';
const desktop = '@media (min-width: 1024px)';

export const shelfStyles = stylex.create({
  section: {
    marginBottom: 32,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  count: {
    fontSize: 13,
    color: 'var(--color-text-disabled)',
  },
  /** One card per row on phones, two on tablet, three on desktop. */
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
    [tablet]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    [desktop]: {
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    },
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.18s ease, background-color 0.18s ease',
    ':hover': {
      borderColor: 'var(--color-accent)',
      backgroundColor: 'var(--color-background-muted)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  cardIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 12,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMeta: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  chevron: {
    color: 'var(--color-text-disabled)',
    flexShrink: 0,
  },
  emptyPrompt: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
    padding: '18px 20px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'var(--color-border)',
  },
  emptyIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'var(--color-background-muted)',
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
  },
  emptyBody: {
    flex: 1,
    minWidth: 180,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  emptyText: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: '3px 0 0',
  },
});
