import { useCallback } from 'react';
// Direct-path imports (react-doctor/no-barrel-import, user-directed):
// QuizScreen is the feature's default export and QuizLaunchRequest lives in
// the feature's types module.
import QuizScreen from '../../features/quiz/QuizScreen';
import type { QuizLaunchRequest } from '../../features/quiz/types/quizFeature.types';
import LibraryScreen from '../../features/catalog/materials/components/LibraryScreen';
import AvailableMaterialsScreen from '../../features/catalog/available/components/AvailableMaterialsScreen';
import PreviewMaterialScreen from '../../features/catalog/available/components/PreviewMaterialScreen';
import SubjectWorkspace from '../../features/catalog/subjects/components/SubjectWorkspace';
import { TermManagerScreen } from '../../features/catalog/terms/components/TermManagerScreen';
import { useTouchMaterial } from '../../features/catalog/materials/hooks/mutations/useTouchMaterial';
import { QuizCanvasBuilder } from '../../features/quiz-management/canvas/QuizCanvasBuilder';
import type { AppRoute } from './routing';
import MaterialWorkspace from './MaterialWorkspace';

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
          onBrowseAvailable={() => navigate({ kind: 'available' })}
        />
      )}
      {currentRoute.kind === 'available' && (
        <AvailableMaterialsScreen
          onOpenMaterial={handleOpenMaterial}
          onPreview={(materialId) => navigate({ kind: 'preview', materialId })}
        />
      )}
      {currentRoute.kind === 'preview' && (
        <PreviewMaterialScreen
          materialId={currentRoute.materialId}
          onBack={() => navigate({ kind: 'available' })}
          onOpenMaterial={handleOpenMaterial}
        />
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
    </>
  );
}
