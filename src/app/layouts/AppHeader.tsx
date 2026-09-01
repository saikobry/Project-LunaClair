import * as stylex from '@stylexjs/stylex';
import { Download } from 'lucide-react';
import logoSvg from '../../assets/logo.svg';
import { SyncStatusPill } from '../../features/sync/components/SyncStatusPill';
import { isIOS, isStandalone } from '../overlays/installDetection';
import { useFocusMode } from '../providers/FocusModeContext';
import { useHeaderScroll } from './useHeaderScroll';
import { styles } from './appHeader.stylex';

export interface AppHeaderProps {
  /** Opens the install instructions dialog (PWA opt-in). */
  onOpenInstallInfo?: () => void;
}

/**
 * Global Top Bar: application identity (logo, title, version) on the left,
 * and system actions (PWA install, cloud sync) on the right.
 *
 * Appears as a horizontal top bar at the top, and morphs into floating
 * compact glass islands with a vertically stacked action capsule on scroll
 * or when Focus Mode is active.
 */
export function AppHeader({ onOpenInstallInfo }: AppHeaderProps) {
  const { isFocusMode } = useFocusMode();
  const isScrolled = useHeaderScroll();
  const isCompact = isScrolled || isFocusMode;

  const showInstall = Boolean(onOpenInstallInfo) && !isStandalone();
  const installLabel = isIOS() ? 'Add to Home Screen' : 'Install app';

  return (
    <header {...stylex.props(styles.header, isCompact && styles.headerCompact)}>
      {/* Brand Identity / Left Island */}
      <div {...stylex.props(styles.brandIsland, isCompact && styles.brandIslandCompact)}>
        <img src={logoSvg} alt="LunaClair" {...stylex.props(styles.logo)} />
        <div {...stylex.props(styles.brandTextWrapper, isCompact && styles.brandTextWrapperCompact)}>
          <span {...stylex.props(styles.title)}>Project LunaClair</span>
          <span {...stylex.props(styles.versionBadge)}>v0.2.0</span>
        </div>
      </div>

      {/* Global Status & Actions / Right Island (Horizontal at top -> Vertical Stack when Scrolled) */}
      <div {...stylex.props(styles.actionsIsland, isCompact && styles.actionsIslandCompact)}>
        {showInstall && (
          <button
            type="button"
            {...stylex.props(
              styles.installButton,
              isCompact && styles.installButtonCompact,
            )}
            onClick={onOpenInstallInfo}
            title={installLabel}
            aria-label={installLabel}
          >
            <Download size={13} />
            <span
              {...stylex.props(
                styles.installLabel,
                isCompact && styles.installLabelCompact,
              )}
            >
              {installLabel}
            </span>
          </button>
        )}
        <SyncStatusPill isCompact={isCompact} />
      </div>
    </header>
  );
}
