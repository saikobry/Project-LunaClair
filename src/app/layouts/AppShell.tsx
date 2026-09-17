import { useState, useEffect, useRef, useLayoutEffect, useContext, useCallback } from 'react';
import gsap from 'gsap';
import * as stylex from '@stylexjs/stylex';
import { FocusModeProvider } from '../providers/FocusModeContext';
import { ApplicationContext, type ApplicationContextValue } from '../providers/ApplicationContext';
import type { AppRoute } from '../routing/routing';
import type { NavActiveSection } from './navigation/navigation.types';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import OfflineBanner from '../overlays/OfflineBanner';
import { InstallPrompt, InstallInstructionsDialog } from '../overlays/InstallPrompt';
import { OnboardingTutorial } from '../overlays/OnboardingTutorial';
import { ShellRoutes } from '../routing/ShellRoutes';
import { useAppRoute } from '../routing/useAppRoute';
import { useShellFocusMode } from './useShellFocusMode';
import { BrowserSyncLifecycle } from '../../infrastructure/browser/lifecycle/BrowserSyncLifecycle';

// Re-export for components that consume the route type via the shell.
export type { AppRoute };

const mobile = '@media (max-width: 768px)';
const tablet = '@media (min-width: 769px) and (max-width: 1023px)';

/**
 * Derives the sidebar context (material/active section) and overlay
 * suppression from the current route.
 */
function getShellRouteContext(currentRoute: AppRoute): {
  collectionId?: string;
  active: NavActiveSection;
  suppressOverlays: boolean;
} {
  let active: NavActiveSection = 'none';
  if (currentRoute.kind === 'home') {
    active = 'home';
  } else if (currentRoute.kind === 'library') {
    active = 'library';
  } else if (currentRoute.kind === 'explore') {
    active = 'explore';
  } else if (currentRoute.kind === 'import') {
    active = 'import';
  } else if (currentRoute.kind === 'analytics') {
    active = 'analytics';
  }

  const suppressOverlays =
    currentRoute.kind === 'quiz-session' || currentRoute.kind === 'quiz-canvas';

  const collectionId = currentRoute.kind === 'collection' ? currentRoute.collectionId : undefined;

  return { collectionId, active, suppressOverlays };
}

/**
 * Initializes background cloud auto-synchronization on application mount
 * when credentials are available.
 */
function useBackgroundSync(appContext: ApplicationContextValue | null) {
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
}

/**
 * Measures the shell `main` bottom padding so overlays can offset their
 * position when the mobile bottom dock clearance changes.
 */
function useMainBottomInset(mainRef: React.RefObject<HTMLElement | null>, isFocusMode: boolean) {
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
  }, [isFocusMode, mainRef]);

  return bottomInset;
}

const mobileMedia = '(max-width: 768px)';
const tabletMedia = '(min-width: 769px) and (max-width: 1023px)';

/**
 * Focus Mode shell motion: GSAP animates the sidebar rail layout width when the
 * mode toggles.
 *
 * GSAP writes inline `width`/`opacity` styles which beat the stylesheet media
 * queries (`rail`: 240px desktop / 64px tablet / 0px mobile). A stale inline
 * width left on the rail after an interrupted tweens/resize produced a
 * 240px/64px blank strip on small screens (the flex `shell` still reserved the
 * rail slot). This hook therefore owns the rail's inline state deterministically:
 * every transition and every resize re-derives the exact inline state from the
 * current focus mode + viewport breakpoint, so no stale width can survive.
 */
function useFocusModeMotion(isFocusMode: boolean) {
  const railRef = useRef<HTMLDivElement>(null);
  const didInitialRail = useRef(false);

  /**
   * Clears every GSAP-led inline layout property on the rail so the stylesheet
   * rules (240 / 64 / 0) are the single source of truth for the current
   * breakpoint. This is the "release" state — used for non-focus viewports and
   * unconditionally at the mobile breakpoint.
   */
  const releaseRail = useCallback((rail: HTMLElement) => {
    gsap.killTweensOf(rail, 'width,opacity');
    rail.style.removeProperty('width');
    rail.style.removeProperty('opacity');
  }, []);

  /**
   * Collapses the rail to width 0 for Focus Mode at desktop/tablet. The inline
   * `width: 0px` must persist at ≥769px because the stylesheet widths (240/64)
   * would otherwise reassert and re-expand the rail.
   */
  const collapseRail = useCallback((rail: HTMLElement) => {
    gsap.killTweensOf(rail, 'width,opacity');
    rail.style.setProperty('width', '0px');
    rail.style.setProperty('opacity', '1');
  }, []);

  /**
   * Re-syncs the rail's inline state to the CURRENT viewport media query.
   * Mobile always releases (CSS `width: 0` already hides the slot; any leftover
   * inline width there is exactly the small-screen blank-gap bug class).
   */
  const syncRail = useCallback(
    (rail: HTMLElement) => {
      const isMobile = window.matchMedia(mobileMedia).matches;
      if (isMobile) {
        releaseRail(rail);
      } else if (isFocusMode) {
        collapseRail(rail);
      } else {
        releaseRail(rail);
      }
    },
    [isFocusMode, releaseRail, collapseRail],
  );

  // Keep GSAP inline styles and CSS breakpoint media queries in lockstep during
  // window resizes (re-evaluates the breakpoint + focus state on every resize).
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const handleResize = () => syncRail(rail);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncRail]);

  // ── GSAP: animate the rail layout width when Focus Mode toggles ──
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const isMobileViewport = window.matchMedia(mobileMedia).matches;
    const isTabletViewport = window.matchMedia(tabletMedia).matches;

    if (isMobileViewport) {
      // Mobile never needs an inline width; CSS `width: 0` owns the slot.
      releaseRail(rail);
      didInitialRail.current = true;
      return;
    }

    if (!didInitialRail.current) {
      didInitialRail.current = true;
      if (isFocusMode) {
        collapseRail(rail);
      } else {
        releaseRail(rail);
      }
      return;
    }

    // Kill any in-flight tween first so an interrupted animation can never freeze
    // a stale intermediate width inline. onComplete then applies the correct
    // persistent state (locked 0px for focus, released to CSS otherwise).
    gsap.killTweensOf(rail, 'width,opacity');

    if (isFocusMode) {
      gsap.to(rail, {
        width: 0,
        opacity: 1,
        duration: 0.35,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onComplete: () => collapseRail(rail),
      });
    } else {
      const openWidth = isTabletViewport ? 64 : 240;
      gsap.to(rail, {
        width: openWidth,
        opacity: 1,
        duration: 0.35,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onComplete: () => releaseRail(rail),
      });
    }
  }, [isFocusMode, releaseRail, collapseRail]);

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

  useBackgroundSync(appContext);

  // PWA install surfaces. The header entry and iOS card only exist in
  // production builds (dev has no SW/manifest, so install is meaningless).
  const [installInfoOpen, setInstallInfoOpen] = useState(false);
  const canOfferInstall = !import.meta.env.DEV;

  // Bottom-bar clearance (px): the shell's declared `main` bottom padding
  const mainRef = useRef<HTMLElement>(null);
  const bottomInset = useMainBottomInset(mainRef, isFocusMode);

  const railRef = useFocusModeMotion(isFocusMode);

  const { collectionId: routeCollectionId, active, suppressOverlays } =
    getShellRouteContext(currentRoute);

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
            collectionId={routeCollectionId}
            active={active}
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
          suppressed={suppressOverlays}
          onShowInstructions={() => setInstallInfoOpen(true)}
        />
        <InstallInstructionsDialog
          isOpen={installInfoOpen}
          onClose={() => setInstallInfoOpen(false)}
        />

        {/* First-run onboarding — one-time welcome flow; Finish syncs default terms */}
        <OnboardingTutorial suppressed={suppressOverlays} />
      </div>
    </FocusModeProvider>
  );
}
