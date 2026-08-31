import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Download, Share, Smartphone } from 'lucide-react';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { Dialog } from '../../shared/ui/Dialog/Dialog';
import { Button } from '../../shared/ui/Button/Button';
import { isIOS, isStandalone } from './installDetection';

/**
 * PWA install surfaces (app-shell chrome).
 *
 * Discovery asymmetry (community-reviewed, Aug 2026): Android/desktop have a
 * native install affordance (address-bar icon, browser menu); iOS has none,
 * so iOS users can only ever get the offline experience if the app tells
 * them "Add to Home Screen" exists. Scope decision:
 * - `InstallPrompt` — a ONE-TIME iOS-only card shown from the SECOND distinct
 *   visit onward (a "welcome back" moment, never first-load and never right
 *   after a quiz — the payoff moment), dismissed forever via localStorage,
 *   hidden when already installed and in dev builds (no SW/manifest there).
 * - `InstallInstructionsDialog` — the opt-in "how do I install this?" dialog
 *   opened from the sidebar row or the card's Install button. Copy branches
 *   by platform (iOS A2HS steps vs. generic browser-install instructions).
 * No `beforeinstallprompt`/deferred-prompt machinery — that only serves
 * Chromium, which already has native discovery.
 */

interface InstallPromptProps {
  /** Opens the instructions dialog (called by the card's Install button). */
  onShowInstructions: () => void;
  /** Hide while immersive routes (quiz session/canvas) own the screen. */
  suppressed?: boolean;
}

/**
 * One-time iOS install card. Fixed bottom-center, quiet themed surface,
 * `zIndex` 300 (above page content and the offline pill, below toasts).
 */
export function InstallPrompt({
  onShowInstructions,
  suppressed = false,
}: InstallPromptProps) {
  // "Not now" dismisses the card forever (persisted).
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEYS.settings.installDismissed) === '1',
  );
  // Visit gate: eligible from the second distinct browser session onward.
  // Initialized once from storage — session count updated synchronously on first session render.
  const [visitEligible] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (!sessionStorage.getItem(STORAGE_KEYS.session.visitMarked)) {
      sessionStorage.setItem(STORAGE_KEYS.session.visitMarked, '1');
      const current = Number.parseInt(localStorage.getItem(STORAGE_KEYS.settings.visitCount) ?? '0', 10);
      localStorage.setItem(STORAGE_KEYS.settings.visitCount, String(current + 1));
      return current + 1 >= 2;
    }
    const current = Number.parseInt(localStorage.getItem(STORAGE_KEYS.settings.visitCount) ?? '0', 10);
    return current >= 2;
  });

  // Visibility is derived during render — nothing is synced to props.
  const show =
    !suppressed &&
    !import.meta.env.DEV &&
    isIOS() &&
    !isStandalone() &&
    !dismissed &&
    visitEligible;

  const handleDismiss = () => {
    // "Not now" hides the card forever — never re-nudged in this browser.
    localStorage.setItem(STORAGE_KEYS.settings.installDismissed, '1');
    setDismissed(true);
  };

  return (
    <div
      role="group"
      {...stylex.props(styles.card, show && styles.cardVisible)}
      aria-label="Install LunaClair"
    >
      <div {...stylex.props(styles.cardHeader)}>
        <Smartphone size={18} {...stylex.props(styles.cardIcon)} aria-hidden="true" />
        <span {...stylex.props(styles.cardTitle)}>Install LunaClair</span>
      </div>
      <p {...stylex.props(styles.cardBody)}>
        Study offline anywhere — add LunaClair to your home screen.
      </p>
      <div {...stylex.props(styles.cardActions)}>
        <Button label="Not now" variant="secondary" onClick={handleDismiss}>
          Not now
        </Button>
        <Button label="Install" variant="primary" onClick={onShowInstructions}>
          Install
        </Button>
      </div>
    </div>
  );
}

interface InstallInstructionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Opt-in "how to install" dialog — copy branches by platform. */
export function InstallInstructionsDialog({ isOpen, onClose }: InstallInstructionsDialogProps) {
  const ios = isIOS();
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={ios ? 'Add LunaClair to your Home Screen' : 'Install LunaClair'}
      width={420}
      purpose="info"
      footer={
        <div {...stylex.props(styles.dialogFooter)}>
          <Button label="Close" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {ios ? (
        <div {...stylex.props(styles.steps)}>
          <div {...stylex.props(styles.step)}>
            <span {...stylex.props(styles.stepNumber)}>1</span>
            <span>
              Tap <Share size={14} {...stylex.props(styles.stepIcon)} aria-hidden="true" />{' '}
              <strong>Share</strong> in the Safari toolbar.
            </span>
          </div>
          <div {...stylex.props(styles.step)}>
            <span {...stylex.props(styles.stepNumber)}>2</span>
            <span>
              Scroll and tap <strong>“Add to Home Screen”</strong>.
            </span>
          </div>
          <div {...stylex.props(styles.step)}>
            <span {...stylex.props(styles.stepNumber)}>3</span>
            <span>
              Tap <strong>Add</strong> — LunaClair opens like a native app and works offline.
            </span>
          </div>
        </div>
      ) : (
        <div {...stylex.props(styles.genericCopy)}>
          <p {...stylex.props(styles.genericParagraph)}>Use your browser’s install option:</p>
          <ul {...stylex.props(styles.genericList)}>
            <li>
              Chrome / Edge desktop: the{' '}
              <Download size={14} {...stylex.props(styles.stepIcon)} aria-hidden="true" /> install
              icon in the address bar.
            </li>
            <li>
              Android Chrome: menu → <strong>Install app</strong> or{' '}
              <strong>Add to Home screen</strong>.
            </li>
          </ul>
        </div>
      )}
    </Dialog>
  );
}

const styles = stylex.create({
  // Fixed bottom-center card — quiet, themed, above content (300) but below
  // the toast stack (9999). On mobile it clears the bottom nav dock
  // (60px + 12px offset + safe-area) so it never covers navigation.
  card: {
    position: 'fixed',
    left: '50%',
    bottom: 24,
    zIndex: 300,
    transform: 'translateX(-50%) translateY(8px)',
    opacity: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: 'min(380px, calc(100vw - 32px))',
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 16,
    backgroundColor: 'var(--color-background-surface)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-border)',
    boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.18)',
    // Hiding (visible → base): visibility flips to hidden AFTER the opacity
    // fade so the exit is visible (mirrors the OfflineBanner pattern).
    transition:
      'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, visibility 0s linear 0.3s',
    '@media (max-width: 768px)': {
      bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
    },
  },
  cardVisible: {
    transform: 'translateX(-50%) translateY(0)',
    opacity: 1,
    visibility: 'visible',
    pointerEvents: 'auto',
    transition:
      'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, visibility 0s linear 0s',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cardIcon: {
    color: 'var(--color-accent)',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  cardBody: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--color-text-secondary)',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  dialogFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
  },

  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  step: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13.5,
    lineHeight: 1.5,
    color: 'var(--color-text-primary)',
  },
  stepNumber: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    flexShrink: 0,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--color-accent)',
    backgroundColor: 'var(--color-accent-muted)',
  },
  stepIcon: {
    verticalAlign: 'text-bottom',
    color: 'var(--color-text-secondary)',
  },
  genericCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 13.5,
    lineHeight: 1.6,
    color: 'var(--color-text-primary)',
  },
  genericParagraph: {
    margin: 0,
  },
  genericList: {
    margin: 0,
    paddingLeft: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
});
