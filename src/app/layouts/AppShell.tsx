import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import * as stylex from '@stylexjs/stylex';
import { FocusModeProvider } from '../providers/FocusModeContext';
import logoSvg from '../../assets/logo.svg';
import type { AppRoute } from './routing';
import { AppSidebar } from './AppSidebar/AppSidebar';
import OfflineBanner from './OfflineBanner';
import { InstallPrompt, InstallInstructionsDialog } from './InstallPrompt';
import { OnboardingTutorial } from './OnboardingTutorial';
import { ShellRoutes } from './ShellRoutes';
import { useAppRoute } from './useAppRoute';
import { useShellFocusMode } from './useShellFocusMode';

// Re-export for components that consume the route type via the shell.
export type { AppRoute };

/**
 * Focus Mode shell motion: GSAP animates the rail's layout width and the
 * floating logo restore button (scale/alpha) when the mode toggles. Both
 * are set (never animated) on first paint so a persisted Focus Mode never
 * flashes before hiding.
 */
function useFocusModeMotion(isFocusMode: boolean) {
  const railRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const didInitialRail = useRef(false);
  const didInitialFab = useRef(false);

  // Keep GSAP inline styles and CSS breakpoint media queries in lockstep during window resizes.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const handleResize = () => {
      if (isFocusMode) {
        gsap.set(rail, { width: 0, opacity: 0 });
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

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isTablet = window.matchMedia('(min-width: 769px) and (max-width: 1023px)').matches;

    if (isMobile) {
      // Mobile rail width is always 0 via CSS media query — never animate
      // it, but mark the initial pass done so later desktop toggles animate.
      didInitialRail.current = true;
      gsap.set(rail, { clearProps: 'width,opacity' });
      return;
    }

    const openWidth = isTablet ? 64 : 240;

    if (!didInitialRail.current) {
      didInitialRail.current = true;
      if (isFocusMode) {
        gsap.set(rail, { width: 0, opacity: 0 });
      } else {
        // No inline styles — let the CSS media queries own the width.
        gsap.set(rail, { clearProps: 'width,opacity' });
      }
      return;
    }

    if (isFocusMode) {
      gsap.to(rail, {
        width: 0,
        opacity: 0,
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

  // ── GSAP: scale/alpha entrance for the floating logo restore button ──
  useLayoutEffect(() => {
    const fab = fabRef.current;
    if (!fab) return;

    if (!didInitialFab.current) {
      didInitialFab.current = true;
      gsap.set(fab, isFocusMode ? { autoAlpha: 1, scale: 1 } : { autoAlpha: 0, scale: 0.8 });
      return;
    }

    gsap.to(fab, {
      autoAlpha: isFocusMode ? 1 : 0,
      scale: isFocusMode ? 1 : 0.8,
      duration: 0.35,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, [isFocusMode]);

  return { railRef, fabRef };
}

const styles = stylex.create({
  shell: {
    display: 'flex',
    minHeight: '100svh',
  },
  rail: {
    width: 240,
    flexShrink: 0,
    '@media (min-width: 769px) and (max-width: 1023px)': {
      width: 64,
    },
    '@media (max-width: 768px)': {
      width: 0,
    },
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    '@media (max-width: 768px)': {
      paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
    },
  },
  // Focus Mode: remove the mobile bottom-bar clearance
  mainFocus: {
    '@media (max-width: 768px)': {
      paddingBottom: 0,
    },
  },
  // NOTE: the quiz-canvas route scrolls the WINDOW (migrated off the internal
  // scroller) — the workspace grows to content and `main`'s mobile bottom
  // padding is its real page-scroll clearance again, exactly like the other
  // routes. No route-scoped `main` pin here anymore (the old
  // `mainCanvasRoute` 100svh clamp was removed with the migration).
  // Floating logo restore button (bottom-left) shown only in Focus Mode
  focusRestoreButton: {
    position: 'fixed',
    bottom: 16,
    left: 16,
    zIndex: 150,
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-background-surface)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-border)',
    borderRadius: 14,
    boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.18)',
    cursor: 'pointer',
    outline: 'none',
    // Grows out of the same bottom-left corner the sidebar morphs into.
    transformOrigin: 'left bottom',
    // Transform/opacity are owned by the GSAP scale/alpha animation — the
    // CSS transition is scoped to background-color so it never re-timelines
    // GSAP's per-frame writes.
    transition: 'background-color 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
    },
  },
  focusRestoreLogo: {
    width: 24,
    height: 24,
    objectFit: 'contain',
  },
});

/**
 * Root application shell: composes the rail, main route content, Focus Mode
 * chrome, and the global overlay surfaces (offline, install, onboarding).
 * Route state and navigation live in `useAppRoute`, Focus Mode in
 * `useShellFocusMode`, and per-route screens in `ShellRoutes`.
 */
export default function AppShell() {
  const { currentRoute, navigate } = useAppRoute();
  const { isFocusMode, toggleFocusMode } = useShellFocusMode();

  // PWA install surfaces. The sidebar entry and iOS card only exist in
  // production builds (dev has no SW/manifest, so install is meaningless).
  const [installInfoOpen, setInstallInfoOpen] = useState(false);
  const canOfferInstall = !import.meta.env.DEV;

  // Bottom-bar clearance (px): the shell's OWN declared `main` bottom padding
  // (`calc(88px + env(safe-area-inset-bottom))` at ≤768px; 0 at >768px and in
  // Focus Mode, where the nav is hidden) — the exact height of app chrome that
  // overlaps the quiz canvas's bottom edge. Passed down to the quiz builder so
  // its toolbar lane's bottom-pin bound / unpin gate stay ABOVE the mobile
  // bottom nav instead of sliding under it.
  const mainRef = useRef<HTMLElement>(null);
  const [bottomInset, setBottomInset] = useState(0);

  // Focus Mode swaps main's class (padding-bottom → 0 at ≤768px), which
  // re-runs this effect — a bottom-pinned toolbar follows the nav's
  // disappearance. `getComputedStyle` forces a recalc, so reading right after
  // the commit already sees the new class; no rAF needed. `setBottomInset`
  // bails out on identical values, so resize storms don't re-render.
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

  const { railRef, fabRef } = useFocusModeMotion(isFocusMode);

  // Extract route context for the WorkspaceRail
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
        <div ref={railRef} {...stylex.props(styles.rail)}>
          <AppSidebar
            subjectId={routeSubjectId}
            materialId={routeMaterialId}
            active={
              currentRoute.kind === 'library'
                ? 'library'
                : currentRoute.kind === 'available' || currentRoute.kind === 'preview'
                  ? 'available'
                  : currentRoute.kind === 'terms'
                    ? 'terms'
                    : 'none'
            }
            isFocusMode={isFocusMode}
            onToggleFocusMode={toggleFocusMode}
            onNavigate={navigate}
            onOpenInstallInfo={canOfferInstall ? () => setInstallInfoOpen(true) : undefined}
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

        {/* Floating logo restore button — GSAP-visible only in Focus Mode */}
        <button
          ref={fabRef}
          type="button"
          {...stylex.props(styles.focusRestoreButton)}
          onClick={toggleFocusMode}
          aria-label="Exit Focus Mode"
          aria-hidden={!isFocusMode}
          tabIndex={isFocusMode ? 0 : -1}
          title="Exit Focus Mode (Cmd/Ctrl+B)"
        >
          <img
            src={logoSvg}
            alt="LunaClair"
            {...stylex.props(styles.focusRestoreLogo)}
          />
        </button>

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
