import * as stylex from '@stylexjs/stylex';
import { Download, Settings } from 'lucide-react';
import logoSvg from '../../assets/logo.svg';
import { APP_VERSION } from '../../shared/constants/appInfo';
import { SyncStatusPill } from '../../features/sync/components/SyncStatusPill';
import { isIOS, isStandalone } from '../overlays/installDetection';
import { useFocusMode } from '../providers/FocusModeContext';
import { useHeaderScroll } from './useHeaderScroll';
import { styles } from './appHeader.stylex';
import type { AppRoute } from '../routing/routing';
import type { NavActiveSection } from './navigation/navigation.types';

export interface AppHeaderProps {
  /** Opens the install instructions dialog (PWA opt-in). */
  onOpenInstallInfo?: () => void;
  /** Active section for the header Settings action (`settings` highlights it). */
  active?: NavActiveSection;
  /** Navigates to a route (the header Settings action goes to `{ kind: 'settings' }`). */
  onNavigate?: (route: AppRoute) => void;
}

/**
 * Global Top Bar: application identity (logo, title, version) on the left,
 * and system actions (PWA install, cloud sync, Settings) on the right.
 *
 * Appears as a horizontal top bar at the top, and morphs into floating
 * compact glass islands with a single-row action capsule on scroll
 * or when Focus Mode is active.
 *
 * On desktop/tablet the bar spans the screens column only (it starts after
 * the navigation rail); in Focus Mode the rail collapses, so the bar takes
 * the full viewport width back.
 */
/**
 * Header Settings action: icon + label at rest, icon-only when compact or on
 * tablet (same vocabulary as the sync pill and the install button).
 */
function HeaderSettingsButton({
  isCompact,
  isActive,
  onNavigate,
}: {
  isCompact: boolean;
  isActive: boolean;
  onNavigate?: (route: AppRoute) => void;
}) {
  return (
    <button
      type="button"
      {...stylex.props(
        styles.settingsButton,
        isActive && styles.settingsButtonActive,
        isCompact && styles.settingsButtonCompact,
      )}
      onClick={() => onNavigate?.({ kind: 'settings' })}
      aria-current={isActive ? 'page' : undefined}
      title="Settings"
      aria-label="Settings"
    >
      <Settings size={13} />
      <span
        {...stylex.props(
          styles.settingsLabel,
          isCompact && styles.settingsLabelCompact,
        )}
      >
        Settings
      </span>
    </button>
  );
}

export function AppHeader({ onOpenInstallInfo, active, onNavigate }: AppHeaderProps) {
  const { isFocusMode } = useFocusMode();
  const isScrolled = useHeaderScroll();
  const isCompact = isScrolled || isFocusMode;

  const showInstall = Boolean(onOpenInstallInfo) && !isStandalone();
  const installLabel = isIOS() ? 'Add to Home Screen' : 'Install app';

  return (
    <header {...stylex.props(styles.header, isCompact && styles.headerCompact, isFocusMode && styles.headerFullWidth)}>
      {/* Brand Identity / Left Island */}
      <div {...stylex.props(styles.brandIsland, isCompact && styles.brandIslandCompact)}>
        <img src={logoSvg} alt="LunaClair" {...stylex.props(styles.logo)} />
        <div {...stylex.props(styles.brandTextWrapper, isCompact && styles.brandTextWrapperCompact)}>
          <span {...stylex.props(styles.title)}>Project LunaClair</span>
          <span {...stylex.props(styles.versionBadge)}>{APP_VERSION}</span>
        </div>
      </div>

      {/* Global Status & Actions / Right Island (stays a horizontal capsule when scrolled) */}
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
        <HeaderSettingsButton
          isCompact={isCompact}
          isActive={active === 'settings'}
          onNavigate={onNavigate}
        />
      </div>
    </header>
  );
}
