import { useEffect, useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Wifi, WifiOff } from 'lucide-react';

/**
 * Global connectivity status indicator (app-shell chrome).
 *
 * Follows `navigator.onLine` and communicates state only — no mutation
 * queueing, retry logic, or sync machinery (that is Phase 9 scope):
 * - while offline → a persistent COMPACT "Offline" pill in the top-right
 *   corner (subtle surface styling so it stays out of the way; the full
 *   reassurance copy lives in its `aria-label`)
 * - on recovery  → transient "You're back online" chip, auto-hides after
 *   a short delay
 *
 * Fixed top-right chrome: zIndex 200 stays above page content and the
 * Focus Mode FAB (150) but below the toast stack (9999). Purely
 * informational — pointer-events: none.
 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [showRecovered, setShowRecovered] = useState(false);
  const wasOffline = useRef(false);

  // Subscribe to connectivity changes. `navigator.onLine` is the initial
  // value; the events keep it fresh for the app's lifetime.
  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => setIsOnline(true);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Recovery flash: announce an offline → online transition once, then hide.
  // The cleanup clears the pending timer so a re-drop hides the chip early.
  useEffect(() => {
    if (isOnline) {
      if (wasOffline.current) {
        setShowRecovered(true);
        const timer = window.setTimeout(() => setShowRecovered(false), 3000);
        return () => window.clearTimeout(timer);
      }
      setShowRecovered(false);
    } else {
      wasOffline.current = true;
      setShowRecovered(false);
    }
  }, [isOnline]);

  const showOffline = !isOnline;
  const visible = showOffline || showRecovered;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      {...stylex.props(styles.wrapper, visible && styles.wrapperVisible)}
    >
      {showOffline ? (
        <div
          aria-label="You're offline. Your changes are saved locally."
          {...stylex.props(styles.pill)}
        >
          <WifiOff size={13} aria-hidden="true" {...stylex.props(styles.pillIcon)} />
          <span>Offline</span>
        </div>
      ) : (
        <div {...stylex.props(styles.chip, styles.chipRecovered)}>
          <Wifi size={16} aria-hidden="true" />
          <span>You're back online</span>
        </div>
      )}
    </div>
  );
}

const styles = stylex.create({
  wrapper: {
    position: 'fixed',
    top: 12,
    right: 16,
    transform: 'translateY(-8px)',
    opacity: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
    zIndex: 200,
    display: 'flex',
    justifyContent: 'flex-end',
    // Toasts (top-right, 9999) may overlap briefly; they are transient, so
    // the indicator stays beneath them.
    // Hiding (visible → base): visibility flips to hidden AFTER the opacity
    // fade-out (0.3s delay) so the exit animation is visible instead of the
    // chip popping out instantly. Showing (base → visible) uses the visible
    // state's transition below, which flips visibility immediately.
    transition:
      'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, visibility 0s linear 0.3s',
  },
  wrapperVisible: {
    transform: 'translateY(0)',
    opacity: 1,
    visibility: 'visible',
    transition:
      'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, visibility 0s linear 0s',
  },
  // Compact persistent offline indicator — small, quiet, corner-anchored.
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 9999,
    backgroundColor: 'var(--color-background-surface)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-border)',
    boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.12)',
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.4,
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  },
  pillIcon: {
    color: 'var(--color-warning)',
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 9999,
    borderStyle: 'solid',
    borderWidth: 1,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.4,
    boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.18)',
    whiteSpace: 'nowrap',
    '@media (max-width: 480px)': {
      whiteSpace: 'normal',
      textAlign: 'center',
    },
  },
  chipRecovered: {
    backgroundColor: 'var(--color-success-muted)',
    color: 'var(--color-on-success-muted)',
    borderColor: 'var(--color-success-border)',
  },
});
