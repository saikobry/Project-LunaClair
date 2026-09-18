import * as stylex from '@stylexjs/stylex';

const compactActions = '@media (max-width: 640px)';

export const workspaceStyles = stylex.create({
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: 'var(--color-text-secondary)',
    fontSize: 14,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 16,
    ':empty': {
      display: 'none',
    },
  },
  tagChip: {
    // Matches the material card's static tag pill (`tagChip` override):
    // tags keep their stored casing (`iOS`, not `Ios`) at a quieter weight.
    textTransform: 'none',
    fontWeight: 600,
  },
  tabBar: {
    // Horizontal scroll lane so all five tabs stay reachable on narrow
    // viewports instead of squeezing into unreadable slivers.
    overflowX: 'auto',
    scrollbarWidth: 'none',
    [compactActions]: {
      marginLeft: -16,
      marginRight: -16,
      paddingLeft: 16,
      paddingRight: 16,
    },
  },
  tabGroupDivider: {
    width: 1,
    height: 20,
    alignSelf: 'center',
    flexShrink: 0,
    backgroundColor: 'var(--color-border)',
  },
});
