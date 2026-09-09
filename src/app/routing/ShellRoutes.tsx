import { useCallback, lazy, Suspense } from 'react';
import type { QuizLaunchRequest } from '../../features/quiz/types/quizFeature.types';
import LibraryHomeScreen from '../screens/library/LibraryHomeScreen';
import { useTouchMaterial } from '../../features/materials/hooks/mutations/useTouchMaterial';
import { WorkspaceSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import type { AppRoute } from './routing';
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

  const handleOpenMaterial = useCallback(
    (materialId: string) => {
      touchMutation.mutate(materialId);
      navigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: 'read' });
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
      navigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: 'manage' });
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
      {currentRoute.kind === 'library' && (
        <LibraryHomeScreen
          onOpenMaterial={handleOpenMaterial}
          onStartQuiz={handleStartQuiz}
          onManage={handleManageQuiz}
          onBrowseAvailable={() => navigate({ kind: 'explore' })}
        />
      )}
      {(currentRoute.kind === 'explore' || currentRoute.kind === 'available') && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <ExploreScreen
            onOpenMaterial={handleOpenMaterial}
            onOpenShare={(shareId) => navigate({ kind: 'share', shareId })}
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
            onOpenMaterial={handleOpenMaterial}
            onCancel={() => navigate({ kind: 'library' })}
          />
        </Suspense>
      )}
      {currentRoute.kind === 'workspace' && currentRoute.workspace === 'material' && (
        <MaterialWorkspaceScreen
          materialId={currentRoute.materialId}
          activeTab={currentRoute.activeTab}
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
                activeTab: 'manage',
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
            onOpenMaterial={(materialId) => handleOpenMaterial(materialId)}
            onStartQuiz={handleStartQuiz}
          />
        </Suspense>
      )}
    </>
  );
}

export default ShellRoutes;
