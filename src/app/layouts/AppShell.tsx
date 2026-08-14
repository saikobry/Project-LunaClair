import { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import * as stylex from '@stylexjs/stylex';
// Direct-path imports (react-doctor/no-barrel-import, user-directed):
// QuizScreen is the feature's default export and QuizLaunchRequest lives in
// the feature's types module.
import QuizScreen from '../../features/quiz/QuizScreen';
import type { QuizLaunchRequest } from '../../features/quiz/types/quizFeature.types';
import LibraryScreen from '../../features/catalog/materials/components/LibraryScreen';
import AvailableMaterialsScreen from '../../features/catalog/materials/components/AvailableMaterialsScreen';
import SubjectWorkspace from '../../features/catalog/subjects/components/SubjectWorkspace';
import { TermManagerScreen } from '../../features/catalog/terms/components/TermManagerScreen';
import { useTouchMaterial } from '../../features/catalog/materials/hooks/mutations/useTouchMaterial';
import { QuizCanvasBuilder } from '../../features/quiz-management/canvas/QuizCanvasBuilder';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { FocusModeProvider } from '../providers/FocusModeContext';
import logoSvg from '../../assets/logo.svg';
import { routeToUrl, urlToRoute, type AppRoute } from './routing';
import MaterialWorkspace from './MaterialWorkspace';
import { AppSidebar } from './AppSidebar/AppSidebar';
import OfflineBanner from './OfflineBanner';
import { InstallPrompt, InstallInstructionsDialog } from './InstallPrompt';

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

export default function AppShell() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    const parsed = urlToRoute(window.location.pathname, window.location.search);
    return parsed ?? { kind: 'library' };
  });

  const [isFocusMode, setIsFocusMode] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEYS.settings.focusMode) === 'true',
  );

  // PWA install surfaces. The sidebar entry and iOS card only exist in
  // production builds (dev has no SW/manifest, so install is meaningless).
  const [installInfoOpen, setInstallInfoOpen] = useState(false);
  const canOfferInstall = !import.meta.env.DEV;

  const touchMutation = useTouchMaterial();

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

  // Toggle Focus Mode. Persistence happens in the effect below so the
  // updater stays pure (StrictMode-safe) and rapid toggles never read
  // stale state.
  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => !prev);
  }, []);

  // Persist Focus Mode whenever it changes (idempotent on mount)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings.focusMode, String(isFocusMode));
  }, [isFocusMode]);

  // Global keyboard shortcut: Cmd+B (macOS) / Ctrl+B (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b' && !event.repeat) {
        event.preventDefault();
        toggleFocusMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFocusMode]);

  const { railRef, fabRef } = useFocusModeMotion(isFocusMode);

  // Sync URL when route changes
  useEffect(() => {
    const url = routeToUrl(currentRoute);
    window.history.pushState({ route: currentRoute }, '', url);
  }, [currentRoute]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (_e: PopStateEvent) => {
      const parsed = urlToRoute(window.location.pathname, window.location.search);
      if (parsed) {
        setCurrentRoute(parsed);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((route: AppRoute) => {
    setCurrentRoute(route);
  }, []);

  const handleOpenMaterial = useCallback(
    (materialId: string, subjectId?: string) => {
      touchMutation.mutate(materialId);
      navigate({ kind: 'workspace', workspace: 'material', materialId, subjectId, activeTab: 'read' });
    },
    [navigate, touchMutation],
  );

  const handleOpenSubject = useCallback(
    (subjectId: string) => {
      navigate({ kind: 'subject', subjectId, activeTab: 'materials' });
    },
    [navigate],
  );

  const handleStartQuiz = useCallback(
    (request: QuizLaunchRequest) => {
      if (request.type === 'quiz') {
        if (request.materialId) {
          // Navigate to Material Workspace on the Quiz tab (from Library/Materials cards)
          navigate({
            kind: 'workspace',
            workspace: 'material',
            materialId: request.materialId,
            subjectId: request.subjectId,
            activeTab: 'quiz',
          });
        } else {
          // Launch a single-quiz session directly
          navigate({
            kind: 'quiz-session',
            quizId: request.quizId ?? '',
            materialIds: [],
            subjectId: request.subjectId,
            returnTo: request.subjectId
              ? { kind: 'subject', subjectId: request.subjectId, activeTab: 'quiz' }
              : { kind: 'library' },
          });
        }
      } else {
        // Multi-quiz (unified) → navigate to quiz session
        navigate({
          kind: 'quiz-session',
          quizId: `unified-${Date.now()}`,
          materialIds: [],
          quizIds: request.quizIds,
          subjectId: request.subjectId,
          returnTo: request.subjectId
            ? { kind: 'subject', subjectId: request.subjectId, activeTab: 'quiz' }
            : { kind: 'library' },
        });
      }
    },
    [navigate],
  );

  const handleManageQuiz = useCallback(
    (materialId: string, subjectId?: string) => {
      navigate({ kind: 'workspace', workspace: 'material', materialId, subjectId, activeTab: 'manage' });
    },
    [navigate],
  );

  const handleExitQuiz = useCallback(() => {
    if (currentRoute.kind === 'quiz-session') {
      navigate(currentRoute.returnTo);
    } else {
      navigate({ kind: 'library' });
    }
  }, [currentRoute, navigate]);

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
            isLibrary={currentRoute.kind === 'library'}
            isAvailable={currentRoute.kind === 'available'}
            isTerms={currentRoute.kind === 'terms'}
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
        {currentRoute.kind === 'library' && (
          <LibraryScreen
            onOpenMaterial={handleOpenMaterial}
            onOpenSubject={handleOpenSubject}
            onStartQuiz={handleStartQuiz}
            onManage={handleManageQuiz}
            onBrowseAvailable={() => navigate({ kind: 'available' })}
          />
        )}
        {currentRoute.kind === 'available' && (
          <AvailableMaterialsScreen onOpenMaterial={handleOpenMaterial} />
        )}
        {currentRoute.kind === 'terms' && (
          <TermManagerScreen />
        )}
        {currentRoute.kind === 'subject' && (
          <SubjectWorkspace
            subjectId={currentRoute.subjectId}
            activeTab={currentRoute.activeTab}
            onNavigate={navigate}
            onOpenMaterial={handleOpenMaterial}
            onStartQuiz={handleStartQuiz}
          />
        )}
        {currentRoute.kind === 'workspace' && currentRoute.workspace === 'material' && (
          <MaterialWorkspace
            materialId={currentRoute.materialId}
            activeTab={currentRoute.activeTab}
            subjectId={currentRoute.subjectId}
            onNavigate={navigate}
          />
        )}
        {currentRoute.kind === 'quiz-canvas' && (
          <QuizCanvasBuilder
            key={currentRoute.quizId ?? 'new-quiz'}
            materialId={currentRoute.materialId}
            quizId={currentRoute.quizId}
            bottomInset={bottomInset}
            onClose={() =>
              navigate({
                kind: 'workspace',
                workspace: 'material',
                materialId: currentRoute.materialId,
                activeTab: 'manage',
              })
            }
          />
        )}
        {currentRoute.kind === 'quiz-session' && (
          <QuizScreen
            quizId={currentRoute.quizId}
            materialIds={currentRoute.materialIds}
            quizIds={currentRoute.quizIds}
            onExit={handleExitQuiz}
          />
        )}
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
      </div>
    </FocusModeProvider>
  );
}
