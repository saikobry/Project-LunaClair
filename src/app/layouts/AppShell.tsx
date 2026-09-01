import { useState, useEffect, useRef, useLayoutEffect, useContext } from 'react';
import gsap from 'gsap';
import * as stylex from '@stylexjs/stylex';
import { FocusModeProvider } from '../providers/FocusModeContext';
import { ApplicationContext } from '../providers/ApplicationContext';
import type { AppRoute } from '../routing/routing';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import OfflineBanner from '../overlays/OfflineBanner';
import { InstallPrompt, InstallInstructionsDialog } from '../overlays/InstallPrompt';
import { OnboardingTutorial } from '../overlays/OnboardingTutorial';
import { ShellRoutes } from '../routing/ShellRoutes';
import { useAppRoute } from '../routing/useAppRoute';
import { useShellFocusMode } from './useShellFocusMode';
import { BrowserSyncLifecycle } from '../../infrastructure/browser/BrowserSyncLifecycle';

// Re-export for components that consume the route type via the shell.
export type { AppRoute };

const mobile = '@media (max-width: 768px)';
const tablet = '@media (min-width: 769px) and (max-width: 1023px)';

/**
 * Focus Mode shell motion: GSAP animates the sidebar rail layout width
 * when the mode toggles.
 */
function useFocusModeMotion(isFocusMode: boolean) {
  const railRef = useRef<HTMLDivElement>(null);
  const didInitialRail = useRef(false);

  // Keep GSAP inline styles and CSS breakpoint media queries in lockstep during window resizes.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const handleResize = () => {
      if (isFocusMode) {
        gsap.set(rail, { width: 0, opacity: 1 });
      } else {
        gsap.set(rail, { clearProps: 'width,opacity' });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFocusMode]);

  // ── GSAP: animate the rail layout width when Focus Mode toggles ──
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
    const isTabletViewport = window.matchMedia('(min-width: 769px) and (max-width: 1023px)').matches;

    if (isMobileViewport) {
      didInitialRail.current = true;
      gsap.set(rail, { clearProps: 'width,opacity' });
      return;
    }

    const openWidth = isTabletViewport ? 64 : 240;

    if (!didInitialRail.current) {
      didInitialRail.current = true;    if (isFocusMode) {
      gsap.set(rail, { width: 0, opacity: 1 });
    } else {
      gsap.set(rail, { clearProps: 'width,opacity' });
    }
      return;
    }

    if (isFocusMode) {
      gsap.to(rail, {
        width: 0,
        opacity: 1,
        duration: 0.35,
        ease: 'power2.inOut',
        overwrite: 'auto',
      });
    } else {
      gsap.to(rail, {
        width: openWidth,
        opacity: 1,
        duration: 0.35,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onComplete: () => gsap.set(rail, { clearProps: 'width,opacity' }),
      });
    }
  }, [isFocusMode]);

  return railRef;
}

const styles = stylex.create({
  shell: {
    display: 'flex',
    minHeight: '100svh',
  },
  headerContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 110,
    pointerEvents: 'none',
  },
  rail: {
    width: 240,
    flexShrink: 0,
    [tablet]: {
      width: 64,
    },
    [mobile]: {
      width: 0,
    },
  },
  railFocus: {
    pointerEvents: 'none',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    paddingTop: 52,
    [mobile]: {
      paddingTop: 48,
      paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
    },
  },
  // Focus Mode: remove mobile bottom-bar clearance (header remains at top)
  mainFocus: {
    [mobile]: {
      paddingBottom: 0,
    },
  },
});

/**
 * Root application shell: composes the global top bar (AppHeader), the navigation rail (AppSidebar),
 * main route content, Focus Mode chrome, and the global overlay surfaces (offline, install, onboarding).
 */
export default function AppShell() {
  const appContext = useContext(ApplicationContext);
  const { currentRoute, navigate } = useAppRoute();
  const { isFocusMode, toggleFocusMode } = useShellFocusMode();

  // Initialize background cloud auto-synchronization on application mount
  useEffect(() => {
    const syncEngine = appContext?.useCases?.sync?.syncEngine;
    const credsProvider = appContext?.infrastructure?.providers?.credentials;
    if (syncEngine && credsProvider) {
      let cleanup: (() => void) | undefined;
      void credsProvider.getCredentials().then((credentials) => {
        if (credentials) {
          const lifecycle = new BrowserSyncLifecycle({
            onTrigger: () => syncEngine.sync(credentials),
          });
          cleanup = lifecycle.start();
        }
      });
      return () => {
        if (cleanup) {
          cleanup();
        }
      };
    }
  }, [appContext]);

  // PWA install surfaces. The header entry and iOS card only exist in
  // production builds (dev has no SW/manifest, so install is meaningless).
  const [installInfoOpen, setInstallInfoOpen] = useState(false);
  const canOfferInstall = !import.meta.env.DEV;

  // Bottom-bar clearance (px): the shell's declared `main` bottom padding
  const mainRef = useRef<HTMLElement>(null);
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    const measure = () => {
      const main = mainRef.current;
      if (!main) return;
      const px = Number.parseFloat(getComputedStyle(main).paddingBottom);
      setBottomInset(Number.isFinite(px) ? Math.max(0, px) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isFocusMode]);

  const railRef = useFocusModeMotion(isFocusMode);

  // Extract route context for the Sidebar
  const routeSubjectId =
    currentRoute.kind === 'subject'
      ? currentRoute.subjectId
      : currentRoute.kind === 'workspace' && currentRoute.workspace === 'material'
        ? currentRoute.subjectId
        : currentRoute.kind === 'quiz-session'
          ? currentRoute.subjectId
          : undefined;

  const routeMaterialId =
    currentRoute.kind === 'workspace' && currentRoute.workspace === 'material'
      ? currentRoute.materialId
      : currentRoute.kind === 'quiz-canvas'
        ? currentRoute.materialId
        : undefined;

  return (
    <FocusModeProvider isFocusMode={isFocusMode}>
      <div {...stylex.props(styles.shell)}>
        {/* Global Top Bar (persists across normal and Focus Mode) */}
        <div {...stylex.props(styles.headerContainer)}>
          <AppHeader
            onOpenInstallInfo={canOfferInstall ? () => setInstallInfoOpen(true) : undefined}
          />
        </div>

        {/* Navigation Rail */}
        <div ref={railRef} {...stylex.props(styles.rail, isFocusMode && styles.railFocus)}>
          <AppSidebar
            subjectId={routeSubjectId}
            materialId={routeMaterialId}
            active={
              currentRoute.kind === 'library'
                ? 'library'
                : currentRoute.kind === 'explore' || currentRoute.kind === 'available' || currentRoute.kind === 'preview'
                  ? 'explore'
                  : currentRoute.kind === 'import'
                    ? 'import'
                    : currentRoute.kind === 'analytics'
                      ? 'analytics'
                      : currentRoute.kind === 'terms'
                        ? 'terms'
                        : 'none'
            }
            isFocusMode={isFocusMode}
            onToggleFocusMode={toggleFocusMode}
            onNavigate={navigate}
          />
        </div>

        <main
          ref={mainRef}
          {...stylex.props(styles.main, isFocusMode && styles.mainFocus)}
        >
          <ShellRoutes
            currentRoute={currentRoute}
            navigate={navigate}
            bottomInset={bottomInset}
          />
        </main>

        {/* Global connectivity status — app-shell chrome */}
        <OfflineBanner />

        {/* PWA install surfaces — one-time iOS card + opt-in instructions */}
        <InstallPrompt
          suppressed={
            currentRoute.kind === 'quiz-session' || currentRoute.kind === 'quiz-canvas'
          }
          onShowInstructions={() => setInstallInfoOpen(true)}
        />
        <InstallInstructionsDialog
          isOpen={installInfoOpen}
          onClose={() => setInstallInfoOpen(false)}
        />

        {/* First-run onboarding — one-time welcome flow; Finish syncs default terms */}
        <OnboardingTutorial
          suppressed={
            currentRoute.kind === 'quiz-session' || currentRoute.kind === 'quiz-canvas'
          }
        />
      </div>
    </FocusModeProvider>
  );
}
