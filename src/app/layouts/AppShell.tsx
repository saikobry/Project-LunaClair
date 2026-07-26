import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { StudyMaterial } from '../../domain/library';
import type { QuizLaunchRequest } from '../../features/quiz/types/quizFeature.types';
import LibraryScreen from '../../features/library/LibraryScreen';
import { ReaderScreen } from '../../features/reader';
import QuizScreen from '../../features/quiz/QuizScreen';
import QuizManagementScreen from '../../features/quiz-management/QuizManagementScreen';
import { useTouchMaterial } from '../../features/library/hooks/mutations/useTouchMaterial';

const styles = stylex.create({
  shell: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100svh',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
});

type AppRoute =
  | { name: 'library' }
  | { name: 'reader'; material: StudyMaterial }
  | { name: 'quiz'; launchRequest: QuizLaunchRequest }
  | { name: 'manage-quiz'; material: StudyMaterial };

export default function AppShell() {
  const [activeRoute, setActiveRoute] = useState<AppRoute>({ name: 'library' });

  const touchMutation = useTouchMaterial();

  const handleOpenMaterial = useCallback(
    (material: StudyMaterial) => {
      touchMutation.mutate(material.id);
      setActiveRoute({ name: 'reader', material });
    },
    [touchMutation],
  );

  const handleBackToLibrary = useCallback(() => {
    setActiveRoute({ name: 'library' });
  }, []);

  const handleStartQuiz = useCallback((request: QuizLaunchRequest) => {
    setActiveRoute({ name: 'quiz', launchRequest: request });
  }, []);

  const handleExitQuiz = useCallback(() => {
    setActiveRoute({ name: 'library' });
  }, []);

  const handleManageQuiz = useCallback((material: StudyMaterial) => {
    setActiveRoute({ name: 'manage-quiz', material });
  }, []);

  return (
    <div {...stylex.props(styles.shell)}>
      <main {...stylex.props(styles.main)}>
        {activeRoute.name === 'library' && (
          <LibraryScreen onOpenMaterial={handleOpenMaterial} onStartQuiz={handleStartQuiz} onManageQuiz={handleManageQuiz} />
        )}
        {activeRoute.name === 'reader' && (
          <ReaderScreen
            material={activeRoute.material}
            onBackToLibrary={handleBackToLibrary}
            onStartQuiz={handleStartQuiz}
            onManageQuiz={handleManageQuiz}
          />
        )}
        {activeRoute.name === 'quiz' && (
          <QuizScreen launchRequest={activeRoute.launchRequest} onExit={handleExitQuiz} />
        )}
        {activeRoute.name === 'manage-quiz' && (
          <QuizManagementScreen material={activeRoute.material} onBack={handleBackToLibrary} />
        )}
      </main>
    </div>
  );
}
