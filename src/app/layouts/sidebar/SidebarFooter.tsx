import * as stylex from '@stylexjs/stylex';
import { Focus } from 'lucide-react';
import { SyncStatusPill } from '../../../features/sync/components/SyncStatusPill';
import logoSvg from '../../../assets/logo.svg';
const tablet = '@media (min-width: 769px) and (max-width: 1023px)';
const mobile = '@media (max-width: 768px)';

export interface SidebarFooterProps {
  onToggleFocusMode: () => void;
}

export function SidebarFooter({ onToggleFocusMode }: SidebarFooterProps) {
  return (
    <div {...stylex.props(styles.footerWrapper)}>
      <div {...stylex.props(styles.syncContainer)}>
        <SyncStatusPill />
      </div>
      <button
        type="button"
        {...stylex.props(styles.footer)}
        onClick={onToggleFocusMode}
        aria-label="Enter Focus Mode"
        title="Enter Focus Mode (Cmd/Ctrl+B)"
      >
        <div {...stylex.props(styles.footerDesktop)}>
          <div {...stylex.props(styles.footerRow1)}>
            <img src={logoSvg} alt="LunaClair" {...stylex.props(styles.footerLogo)} />
            <span {...stylex.props(styles.footerTitle)}>Project LunaClair</span>
            <span {...stylex.props(styles.versionBadge, styles.footerRow1Badge)}>
              v0.2.0
            </span>
          </div>
          <div {...stylex.props(styles.footerRow2)}>
            <span {...stylex.props(styles.footerFocusLabel)}>Focus Mode (Cmd+B)</span>
            <Focus size={14} {...stylex.props(styles.footerFocusIcon)} aria-hidden="true" />
          </div>
        </div>
        <div {...stylex.props(styles.footerTablet)}>
          <img src={logoSvg} alt="LunaClair" {...stylex.props(styles.footerLogo)} />
          <span {...stylex.props(styles.versionBadge)}>v0.2.0</span>
          <Focus size={14} {...stylex.props(styles.footerFocusIcon)} aria-hidden="true" />
        </div>
      </button>
    </div>
  );
}

const styles = stylex.create({
  footerWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
    [mobile]: {
      display: 'none',
    },
  },
  syncContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    paddingLeft: 4,
    paddingRight: 4,
    boxSizing: 'border-box',
    [tablet]: {
      justifyContent: 'center',
      paddingLeft: 0,
      paddingRight: 0,
    },
  },
  // Unified bottom-left brand card: logo, version, and Focus Mode toggle
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-border)',
    borderRadius: 16,
    backgroundColor: 'var(--color-background-surface)',
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
    },
    // Tablet: the 60px rail already provides its own border/background —
    // strip the nested card so the logo & badge sit cleanly inside it.
    [tablet]: {
      borderStyle: 'none',
      backgroundColor: 'transparent',
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    },
    [mobile]: {
      display: 'none',
    },
  },
  // Desktop: 2-row brand card — row 1 brand identity, row 2 Focus trigger
  footerDesktop: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    [tablet]: {
      display: 'none',
    },
  },
  footerRow1: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  footerRow1Badge: {
    marginLeft: 'auto',
  },
  footerRow2: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  footerTablet: {
    display: 'none',
    [tablet]: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
    },
  },
  footerLogo: {
    width: 22,
    height: 22,
    objectFit: 'contain',
    flexShrink: 0,
  },
  footerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
  },
  footerFocusLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  },
  footerFocusIcon: {
    marginLeft: 'auto',
    flexShrink: 0,
    color: 'var(--color-text-secondary)',
    [tablet]: {
      marginLeft: 0,
    },
  },
  versionBadge: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-background-muted)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-border)',
    borderRadius: 999,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 6,
    paddingRight: 6,
    whiteSpace: 'nowrap',
  },
});
