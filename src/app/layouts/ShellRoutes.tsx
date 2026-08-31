import { useCallback, lazy, Suspense } from 'react';
import type { QuizLaunchRequest } from '../../features/quiz/types/quizFeature.types';
import LibraryScreen from '../../features/catalog/materials/components/LibraryScreen';
import { useTouchMaterial } from '../../features/catalog/materials/hooks/mutations/useTouchMaterial';
import { WorkspaceSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import type { AppRoute } from './routing';
import MaterialWorkspace from './MaterialWorkspace';

// Route-level code-splitting for heavy screens
const ExploreScreen = lazy(() => import('../../features/catalog/explore/components/ExploreScreen'));
const PreviewMaterialScreen = lazy(() => import('../../features/catalog/available/components/PreviewMaterialScreen'));
const SubjectWorkspace = lazy(() => import('../../features/catalog/subjects/components/SubjectWorkspace'));
const TermManagerScreen = lazy(() =>
  import('../../features/catalog/terms/components/TermManagerScreen').then((m) => ({ default: m.TermManagerScreen })),
);
const AnalyticsScreen = lazy(() => import('../../features/analytics/AnalyticsScreen'));
const QuizCanvasBuilder = lazy(() =>
  import('../../features/quiz-management/canvas/QuizCanvasBuilder').then((m) => ({ default: m.QuizCanvasBuilder })),
);
const QuizScreen = lazy(() => import('../../features/quiz/QuizScreen'));
const SharedPackageScreen = lazy(() =>
  import('../../features/package/components/SharedPackageScreen').then((m) => ({ default: m.SharedPackageScreen })),
);
const ImporterScreen = lazy(() => import('../../features/importer/ImporterScreen'));

interface ShellRoutesProps {
  currentRoute: AppRoute;
  navigate: (route: AppRoute) => void;
  /** Bottom-bar clearance (px) for the quiz canvas toolbar lane. */
  bottomInset: number;
}

/**
 * Renders the screen for the current route and owns the navigation handlers
 * the route screens need (open material/subject, launch quiz, manage, exit).
 * Extracted from `AppShell` so the shell stays a thin composition root.
 */
export function ShellRoutes({ currentRoute, navigate, bottomInset }: ShellRoutesProps) {
  const touchMutation = useTouchMaterial();

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

  return (
    <>
      {currentRoute.kind === 'library' && (
        <LibraryScreen
          onOpenMaterial={handleOpenMaterial}
          onOpenSubject={handleOpenSubject}
          onStartQuiz={handleStartQuiz}
          onManage={handleManageQuiz}
          onBrowseAvailable={() => navigate({ kind: 'explore' })}
        />
      )}
      {(currentRoute.kind === 'explore' || currentRoute.kind === 'available') && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <ExploreScreen
            onOpenMaterial={handleOpenMaterial}
            onPreview={(materialId) => navigate({ kind: 'preview', materialId })}
            onOpenShare={(shareId) => navigate({ kind: 'share', shareId })}
          />
        </Suspense>
      )}
      {currentRoute.kind === 'preview' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <PreviewMaterialScreen
            materialId={currentRoute.materialId}
            onBack={() => navigate({ kind: 'explore' })}
            onOpenMaterial={handleOpenMaterial}
          />
        </Suspense>
      )}
      {currentRoute.kind === 'terms' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <TermManagerScreen />
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
      {currentRoute.kind === 'subject' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <SubjectWorkspace
            subjectId={currentRoute.subjectId}
            activeTab={currentRoute.activeTab}
            onNavigate={navigate}
            onOpenMaterial={handleOpenMaterial}
            onStartQuiz={handleStartQuiz}
          />
        </Suspense>
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
        <Suspense fallback={<WorkspaceSkeleton />}>
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
        </Suspense>
      )}
      {currentRoute.kind === 'quiz-session' && (
        <Suspense fallback={<WorkspaceSkeleton />}>
          <QuizScreen
            quizId={currentRoute.quizId}
            materialIds={currentRoute.materialIds}
            quizIds={currentRoute.quizIds}
            onExit={handleExitQuiz}
          />
        </Suspense>
      )}
    </>
  );
}
