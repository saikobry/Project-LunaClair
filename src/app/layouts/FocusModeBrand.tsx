import * as stylex from '@stylexjs/stylex';
import logoSvg from '../../assets/logo.svg';
import { useFocusMode } from '../providers/FocusModeContext';
import type { AppRoute } from '../routing/routing';
import { styles as appHeaderStyles } from './appHeader.stylex';
import { useFocusBrandFlip } from './useFocusBrandFlip';

const mobile = '@media (max-width: 768px)';

const styles = stylex.create({
  brand: {
    position: 'fixed',
    top: 12,
    left: 16,
    zIndex: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
    cursor: 'pointer',
    boxSizing: 'border-box',
    // Hidden state: non-interactive, and `visibility` flips only after the
    // fade-out completes so the exit animation actually plays.
    opacity: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
    transform: 'translateY(-6px) scale(0.94)',
    transition:
      'opacity 0.15s ease, transform 0.15s ease, visibility 0s linear 0.15s',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
    },
    // Mobile keeps the header's own compact logo pill — no second brand.
    [mobile]: {
      display: 'none',
    },
  },
  /**
   * Visible state. The enter fade runs undelayed — the FLIP flight
   * (`useFocusBrandFlip`) owns the handoff continuity, so no wait is needed;
   * the exit still leaves immediately while the rail brands fade back in.
   */
  brandVisible: {
    opacity: 1,
    visibility: 'visible',
    pointerEvents: 'auto',
    transform: 'translateY(0px) scale(1)',
    transition: 'opacity 0.22s ease, transform 0.22s ease, visibility 0s',
  },
});

export interface FocusModeBrandProps {
  onNavigate: (route: AppRoute) => void;
}

/**
 * Focus Mode brand capsule (desktop/tablet): a logo-only home button pinned
 * to the top-left while Focus Mode is active. The desktop sidebar brand
 * fades with the rail chrome and the tablet rail collapses into its restore
 * pill, so without this there would be no brand or home affordance left —
 * and the top-left corner sits empty since the header spans full width in
 * Focus Mode with its own brand hidden.
 *
 * Always mounted: the hidden/visible styles crossfade asymmetrically
 * (enter with the flight, exit immediate), and the FLIP flight travels the
 * logo-to-logo vector so the handoff reads as one logo moving rather than
 * two flashing.
 */
export function FocusModeBrand({ onNavigate }: FocusModeBrandProps) {
  const { isFocusMode } = useFocusMode();
  useFocusBrandFlip(isFocusMode);

  return (
    <button
      type="button"
      data-brand-target
      {...stylex.props(styles.brand, isFocusMode && styles.brandVisible)}
      onClick={() => onNavigate({ kind: 'home' })}
      aria-label="Project LunaClair home"
      aria-hidden={!isFocusMode}
      tabIndex={isFocusMode ? undefined : -1}
      title="Project LunaClair home"
    >
      <img src={logoSvg} alt="" aria-hidden="true" data-brand-logo="fmbrand" {...stylex.props(appHeaderStyles.logo)} />
    </button>
  );
}
