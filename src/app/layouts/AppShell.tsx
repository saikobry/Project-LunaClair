import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { QuizLaunchRequest } from '../../features/quiz/types/quizFeature.types';
import LibraryScreen from '../../features/library/LibraryScreen';
import SubjectWorkspace from '../../features/subject/SubjectWorkspace';
import MaterialWorkspace from '../../features/workspace/MaterialWorkspace';
import QuizScreen from '../../features/quiz/QuizScreen';
import { WorkspaceRail } from '../../features/workspace/components/WorkspaceRail';
import { useTouchMaterial } from '../../features/library/hooks/mutations/useTouchMaterial';

const styles = stylex.create({
  shell: {
    display: 'flex',
    minHeight: '100svh',
  },
  rail: {
    width: 64,
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
});

export type AppRoute =
  | { kind: 'library' }
  | { kind: 'subject'; subjectId: string; activeTab: 'materials' | 'quiz' }
  | { kind: 'workspace'; workspace: 'material'; materialId: string; activeTab: 'read' | 'quiz' | 'manage'; subjectId?: string }
  | { kind: 'quiz-session'; quizId: string; materialIds: string[]; subjectId?: string; returnTo: AppRoute };

export default function AppShell() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>({ kind: 'library' });

  const touchMutation = useTouchMaterial();

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
      navigate({
        kind: 'quiz-session',
        quizId: request.quizId ?? '',
        materialIds: [request.materialId],
        returnTo: { kind: 'workspace', workspace: 'material', materialId: request.materialId, activeTab: 'quiz' },
      });
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
      : undefined;

  return (
    <div {...stylex.props(styles.shell)}>
      <div {...stylex.props(styles.rail)}>
        <WorkspaceRail
          subjectId={routeSubjectId}
          materialId={routeMaterialId}
          isLibrary={currentRoute.kind === 'library'}
          onNavigate={navigate}
        />
      </div>
      <main {...stylex.props(styles.main)}>
        {currentRoute.kind === 'library' && (
          <LibraryScreen
            onOpenMaterial={handleOpenMaterial}
            onOpenSubject={handleOpenSubject}
            onStartQuiz={handleStartQuiz}
            onManageQuiz={handleManageQuiz}
          />
        )}
        {currentRoute.kind === 'subject' && (
          <SubjectWorkspace
            subjectId={currentRoute.subjectId}
            activeTab={currentRoute.activeTab}
            onNavigate={navigate}
            onStartQuiz={handleStartQuiz}
          />
        )}
        {currentRoute.kind === 'workspace' && currentRoute.workspace === 'material' && (
          <MaterialWorkspace
            materialId={currentRoute.materialId}
            activeTab={currentRoute.activeTab}
            subjectId={currentRoute.subjectId}
            onNavigate={navigate}
            onStartQuiz={handleStartQuiz}
          />
        )}
        {currentRoute.kind === 'quiz-session' && (
          <QuizScreen
            quizId={currentRoute.quizId}
            materialIds={currentRoute.materialIds}
            onExit={handleExitQuiz}
          />
        )}
      </main>
    </div>
  );
}
