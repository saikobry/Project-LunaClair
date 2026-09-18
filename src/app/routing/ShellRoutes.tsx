import { useCallback, lazy, Suspense } from 'react';
import type { QuizLaunchRequest } from '../../features/quiz/types/quizFeature.types';
import HomeScreen from '../screens/home/HomeScreen';
import LibraryScreen from '../screens/library/LibraryScreen';
import { useTouchMaterial } from '../../features/materials/hooks/mutations/useTouchMaterial';
import { WorkspaceSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import type { AppRoute, ExploreSortOption } from './routing';
import MaterialWorkspaceScreen from '../screens/material-workspace/MaterialWorkspaceScreen';

// Route-level code-splitting for screen compositions
const ExploreScreen = lazy(() => import('../screens/explore/ExploreScreen'));
const AnalyticsScreen = lazy(() => import('../screens/analytics/AnalyticsScreen'));
const QuizCanvasBuilderScreen = lazy(() =>
  import('../screens/quiz-canvas/QuizCanvasBuilderScreen').then((m) => ({ default: m.QuizCanvasBuilderScreen })),
);
const QuizSessionScreen = lazy(() => import('../screens/quiz-session/QuizSessionScreen'));
const SharedPackageScreen = lazy(() =>
  import('../screens/shared-package/SharedPackageScreen').then((m) => ({ default: m.SharedPackageScreen })),
);
const ImporterScreen = lazy(() => import('../screens/importer/ImporterScreen'));
const CollectionWorkspaceScreen = lazy(
  () => import('../screens/collection-workspace/CollectionWorkspaceScreen'),
);

/**
 * The hub's filters are URL state, so the shell keeps `/explore` canonical by
 * normalizing defaults (`popular`, blank query) back to undefined — the same
 * treatment `/library` gets for `all` / `overview`.
 */
function canonicalExploreRoute(next: { q?: string; sort?: 'popular' | 'recent' }): AppRoute {
  const q = next.q?.trim();
  return {
    kind: 'explore',
    q: q ? q : undefined,
    sort: !next.sort || next.sort === 'popular' ? undefined : next.sort,
  };
}

/**
 * The Explore route's wiring, split out of the route table so the shell's own
 * branch count stays flat as screens gain filter state. It owns the filter
 * commit callback because only this route has URL-backed filters today.
 */
function ExploreRoute({
  route,
  navigate,
  onOpenMaterial,
}: {
  route: Extract<AppRoute, { kind: 'explore' }>;
  navigate: (route: AppRoute) => void;
  onOpenMaterial: (materialId: string) => void;
}) {
  const handleFiltersChange = useCallback(
    (next: { q?: string; sort?: ExploreSortOption }) => navigate(canonicalExploreRoute(next)),
    [navigate],
  );

  const q = route.q;
  const sort = route.sort;

  return (
    <ExploreScreen
      q={q}
      sort={sort}
      onFiltersChange={handleFiltersChange}
      onOpenMaterial={onOpenMaterial}
      // The hub is the only in-app entry to a share, so it stamps its own route
      // as the origin: leaving the package then returns to this exact view —
      // filters included — instead of an unfiltered `/explore`.
      onOpenShare={(shareId) =>
        navigate({ kind: 'share', shareId, from: { kind: 'explore', q, sort } })
      }
    />
  );
}

interface ShellRoutesProps {
  currentRoute: AppRoute;
  navigate: (route: AppRoute) => void;
  /** Bottom-bar clearance (px) for the quiz canvas toolbar lane. */
  bottomInset: number;
}

/**
 * Renders the screen for the current route and owns the navigation handlers
 * the route screens need (open material, launch quiz, manage, exit).
 * Extracted from `AppShell` so the shell stays a thin composition root.
 */
export function ShellRoutes({ currentRoute, navigate, bottomInset }: ShellRoutesProps) {
  const touchMutation = useTouchMaterial();

  // `fromCollectionId` is the entry-point origin the workspace breadcrumb needs
  // (only the collection route has one today); every other caller omits it.
  const handleOpenMaterial = useCallback(
    (materialId: string, fromCollectionId?: string) => {
      touchMutation.mutate(materialId);
      navigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: 'read', fromCollectionId });
    },
    [navigate, touchMutation],
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
            activeTab: 'quiz',
          });
        } else {
          // Launch a single-quiz session directly
          navigate({
            kind: 'quiz-session',
            quizId: request.quizId ?? '',
            materialIds: [],
            returnTo: { kind: 'library' },
          });
        }
      } else {
        // Multi-quiz (unified) → navigate to quiz session
        navigate({
          kind: 'quiz-session',
          quizId: `unified-${Date.now()}`,
          materialIds: [],
          quizIds: request.quizIds,
          returnTo: { kind: 'library' },
        });
      }
    },
    [navigate],
  );

  const handleManageQuiz = useCallback(
    (materialId: string) => {
      navigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: 'questions' });
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

  return (
    <>
      {currentRoute.kind === 'home' && (
        <HomeScreen
          onOpenMaterial={handleOpenMaterial}
          onStartQuiz={handleStartQuiz}
          onNavigateToLibrary={() => navigate({ kind: 'library' })}
          onNavigateToExplore={() => navigate({ kind: 'explore' })}
          onNavigateToImport={() => navigate({ kind: 'import' })}
        />
      )}
      {currentRoute.kind === 'library' && (
        <LibraryScreen
          filter={currentRoute.filter}
          view={currentRoute.view}
          // `all` and `overview` are the defaults — keep the canonical `/library` URL.
          onFilterChange={(filter) =>
            navigate({ kind: 'library', filter: filter === 'all' ? undefined : filter, view: currentRoute.view })
          }
          onViewChange={(view) =>
            navigate({ kind: 'library', filter: currentRoute.filter, view: view === 'overview' ? undefined : view })
          }
          onOpenMaterial={handleOpenMaterial}
          onStartQuiz={handleStartQuiz}
          onManage={handleManageQuiz}
          onOpenCollection={(collectionId) => navigate({ kind: 'collection', collectionId })}
          onBrowseAvailable={() => navigate({ kind: 'explore' })}
        />
      )}
      {currentRoute.kind === 'explore' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <ExploreRoute
            route={currentRoute}
            navigate={navigate}
            onOpenMaterial={handleOpenMaterial}
          />
        </Suspense>
      )}
      {currentRoute.kind === 'analytics' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <AnalyticsScreen />
        </Suspense>
      )}
      {currentRoute.kind === 'import' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <ImporterScreen
            onOpenMaterial={handleOpenMaterial}
            onCancel={() => navigate({ kind: 'library' })}
          />
        </Suspense>
      )}
      {currentRoute.kind === 'share' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <SharedPackageScreen
            shareId={currentRoute.shareId}
            from={currentRoute.from}
            onOpenMaterial={handleOpenMaterial}
            // Leave to the route the package was opened from; an external
            // `/s/:code` link has none, and the library is the honest landing
            // place when nothing preceded the package.
            onCancel={() => navigate(currentRoute.from ?? { kind: 'library' })}
          />
        </Suspense>
      )}
      {currentRoute.kind === 'workspace' && currentRoute.workspace === 'material' && (
        <MaterialWorkspaceScreen
          materialId={currentRoute.materialId}
          activeTab={currentRoute.activeTab}
          fromCollectionId={currentRoute.fromCollectionId}
          onNavigate={navigate}
        />
      )}
      {currentRoute.kind === 'quiz-canvas' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <QuizCanvasBuilderScreen
            key={currentRoute.quizId ?? 'new-quiz'}
            materialId={currentRoute.materialId}
            quizId={currentRoute.quizId}
            bottomInset={bottomInset}
            onClose={() =>
              navigate({
                kind: 'workspace',
                workspace: 'material',
                materialId: currentRoute.materialId,
                activeTab: 'questions',
              })
            }
          />
        </Suspense>
      )}
      {currentRoute.kind === 'quiz-session' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <QuizSessionScreen
            quizId={currentRoute.quizId}
            materialIds={currentRoute.materialIds}
            quizIds={currentRoute.quizIds}
            onExit={handleExitQuiz}
          />
        </Suspense>
      )}
      {currentRoute.kind === 'collection' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <CollectionWorkspaceScreen
            collectionId={currentRoute.collectionId}
            onNavigate={navigate}
            onOpenMaterial={(materialId) => handleOpenMaterial(materialId, currentRoute.collectionId)}
            onStartQuiz={handleStartQuiz}
          />
        </Suspense>
      )}
    </>
  );
}

export default ShellRoutes;
