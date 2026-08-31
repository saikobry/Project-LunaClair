import * as stylex from '@stylexjs/stylex';
import { Download } from 'lucide-react';
import logoSvg from '../../assets/logo.svg';
import { SyncStatusPill } from '../../features/sync/components/SyncStatusPill';
import { isIOS, isStandalone } from '../overlays/installDetection';

const mobile = '@media (max-width: 768px)';

export interface AppHeaderProps {
  /** Opens the install instructions dialog (PWA opt-in). */
  onOpenInstallInfo?: () => void;
}

/**
 * Global Top Bar: application identity (logo, title, version) on the left,
 * and system state / actions (PWA install, cloud sync) on the right.
 */
export function AppHeader({ onOpenInstallInfo }: AppHeaderProps) {
  const showInstall = Boolean(onOpenInstallInfo) && !isStandalone();
  const installLabel = isIOS() ? 'Add to Home Screen' : 'Install app';

  return (
    <header {...stylex.props(styles.header)}>
      {/* Brand Identity */}
      <div {...stylex.props(styles.brand)}>
        <img src={logoSvg} alt="LunaClair" {...stylex.props(styles.logo)} />
        <span {...stylex.props(styles.title)}>Project LunaClair</span>
        <span {...stylex.props(styles.versionBadge)}>v0.2.0</span>
      </div>

      {/* Global Status & Actions */}
      <div {...stylex.props(styles.actions)}>
        {showInstall && (
          <button
            type="button"
            {...stylex.props(styles.installButton)}
            onClick={onOpenInstallInfo}
            title={installLabel}
          >
            <Download size={14} />
            <span {...stylex.props(styles.installLabel)}>{installLabel}</span>
          </button>
        )}
        <SyncStatusPill />
      </div>
    </header>
  );
}

const styles = stylex.create({
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    zIndex: 110,
    backgroundColor: 'var(--color-background-surface)',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 16,
    boxSizing: 'border-box',
    [mobile]: {
      height: 48,
      paddingLeft: 12,
      paddingRight: 12,
    },
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 22,
    height: 22,
    objectFit: 'contain',
    flexShrink: 0,
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
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
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
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      color: 'var(--color-text-primary)',
    },
    [mobile]: {
      display: 'none',
    },
  },
  installLabel: {
    whiteSpace: 'nowrap',
  },
});
