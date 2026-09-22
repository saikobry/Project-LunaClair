import * as stylex from '@stylexjs/stylex';

const mobile = '@media (max-width: 768px)';
const nonMobile = '@media (min-width: 769px)';
const tablet = '@media (min-width: 769px) and (max-width: 1023px)';
const desktop = '@media (min-width: 1024px)';

export const styles = stylex.create({
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    zIndex: 110,
    backgroundColor: 'var(--color-background-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 16,
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    transition:
      'background-color 0.24s cubic-bezier(0.4, 0, 0.2, 1), padding 0.24s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s ease',
    // Desktop/tablet: the brand island is hidden (brand lives in the nav
    // chrome), leaving the actions island as the only child — pin it right,
    // since space-between with a single child would park it left.
    [nonMobile]: {
      justifyContent: 'flex-end',
    },
    // Desktop/tablet: the bar spans the screens column only — it starts
    // after the navigation rail instead of covering the full viewport width.
    // Mobile keeps the full-width bar (the rail slot is 0 there).
    [tablet]: {
      left: 64,
    },
    [desktop]: {
      left: 240,
    },
    [mobile]: {
      height: 48,
      paddingLeft: 12,
      paddingRight: 12,
    },
  },
  /**
   * Focus Mode owns the full viewport width again: the rail collapses to 0,
   * so there is no screens-column inset left to honor. The `left` transition
   * on the header glides it outward alongside the rail animation.
   */
  headerFullWidth: {
    left: 0,
  },
  headerCompact: {
    backgroundColor: 'transparent',
    pointerEvents: 'none',
    alignItems: 'flex-start',
    height: 'auto',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    [mobile]: {
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 12,
      paddingRight: 12,
    },
  },
  brandIsland: {
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'auto',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 9999,
    boxSizing: 'border-box',
    transition:
      'background-color 0.24s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.24s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.24s cubic-bezier(0.4, 0, 0.2, 1), padding 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
    // Desktop/tablet brand lives in the navigation chrome (sidebar lockup /
    // rail logo), so the header keeps it on mobile only.
    [nonMobile]: {
      display: 'none',
    },
  },
  brandIslandCompact: {
    backgroundColor: 'var(--color-background-surface)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderColor: 'var(--color-border)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 8,
  },
  logo: {
    width: 22,
    height: 22,
    objectFit: 'contain',
    flexShrink: 0,
    display: 'block',
  },
  brandTextWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    maxWidth: 240,
    opacity: 1,
    marginLeft: 8,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    transition:
      'max-width 0.24s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1), margin 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  brandTextWrapperCompact: {
    maxWidth: 0,
    opacity: 0,
    marginLeft: 0,
    pointerEvents: 'none',
  },
  title: {
    fontSize: 13.5,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
  },
  versionBadge: {
    fontSize: 9.5,
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-background-muted)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-border)',
    borderRadius: 999,
    paddingTop: 1.5,
    paddingBottom: 1.5,
    paddingLeft: 6,
    paddingRight: 6,
    whiteSpace: 'nowrap',
  },
  actionsIsland: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'auto',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 9999,
    boxSizing: 'border-box',
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    transition:
      'background-color 0.24s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.24s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.24s cubic-bezier(0.4, 0, 0.2, 1), padding 0.24s cubic-bezier(0.4, 0, 0.2, 1), gap 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  actionsIslandCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'var(--color-background-surface)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderColor: 'var(--color-border)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 4,
    paddingRight: 4,
  },
  installButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 500,
    boxSizing: 'border-box',
    outline: 'none',
    transition:
      'background-color 0.15s ease, color 0.15s ease, border-radius 0.2s ease, width 0.2s ease, padding 0.2s ease, border-color 0.2s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      color: 'var(--color-text-primary)',
    },
    ':focus-visible': {
      boxShadow: '0 0 0 2px var(--color-accent)',
    },
    [mobile]: {
      height: 28,
      paddingLeft: 8,
      paddingRight: 8,
      fontSize: 11.5,
    },
  },
  installButtonCompact: {
    width: 26,
    height: 26,
    paddingLeft: 0,
    paddingRight: 0,
    borderRadius: 9999,
    justifyContent: 'center',
    gap: 0,
    borderColor: 'transparent',
    [mobile]: {
      width: 26,
      height: 26,
      paddingLeft: 0,
      paddingRight: 0,
    },
  },
  installLabel: {
    whiteSpace: 'nowrap',
  },
  installLabelCompact: {
    display: 'none',
  },
  settingsButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 500,
    boxSizing: 'border-box',
    outline: 'none',
    transition:
      'background-color 0.15s ease, color 0.15s ease, border-radius 0.2s ease, width 0.2s ease, padding 0.2s ease, border-color 0.2s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      color: 'var(--color-text-primary)',
    },
    ':focus-visible': {
      boxShadow: '0 0 0 2px var(--color-accent)',
    },
    [mobile]: {
      height: 28,
      paddingLeft: 8,
      paddingRight: 8,
      fontSize: 11.5,
    },
  },
  settingsButtonActive: {
    backgroundColor: 'var(--color-accent-muted)',
    borderColor: 'var(--color-accent)',
    color: 'var(--color-accent)',
    ':hover': {
      backgroundColor: 'var(--color-accent-muted)',
      color: 'var(--color-accent)',
    },
  },
  settingsButtonCompact: {
    width: 26,
    height: 26,
    paddingLeft: 0,
    paddingRight: 0,
    borderRadius: 9999,
    justifyContent: 'center',
    gap: 0,
    borderColor: 'transparent',
    [mobile]: {
      width: 26,
      height: 26,
      paddingLeft: 0,
      paddingRight: 0,
    },
  },
  settingsLabel: {
    whiteSpace: 'nowrap',
    [tablet]: {
      display: 'none',
    },
  },
  settingsLabelCompact: {
    display: 'none',
  },
});
