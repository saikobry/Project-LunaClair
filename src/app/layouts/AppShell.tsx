import { useState, useCallback, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { QuizLaunchRequest } from '../../features/quiz/types/quizFeature.types';
import LibraryScreen from '../../features/library/LibraryScreen';
import SubjectWorkspace from '../../features/subject/SubjectWorkspace';
import MaterialWorkspace from '../../features/workspace/MaterialWorkspace';
import QuizScreen from '../../features/quiz/QuizScreen';
import { TermManagerScreen } from '../../features/settings';
import { AppSidebar } from '../../features/workspace/components/AppSidebar';
import { useTouchMaterial } from '../../features/library/hooks/mutations/useTouchMaterial';

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
});

export type AppRoute =
  | { kind: 'library' }
  | { kind: 'terms' }
  | { kind: 'subject'; subjectId: string; activeTab: 'materials' | 'quiz' }
  | { kind: 'workspace'; workspace: 'material'; materialId: string; activeTab: 'read' | 'quiz' | 'manage'; subjectId?: string }
  | { kind: 'quiz-session'; quizId: string; materialIds: string[]; quizIds?: string[]; subjectId?: string; returnTo: AppRoute };

/**
 * Serialize an AppRoute to a URL path string.
 */
function routeToUrl(route: AppRoute): string {
  switch (route.kind) {
    case 'library':
      return '/';
    case 'terms':
      return '/terms';
    case 'subject':
      return `/subjects/${route.subjectId}?tab=${route.activeTab}`;
    case 'workspace':
      return `/materials/${route.materialId}?tab=${route.activeTab}${route.subjectId ? `&subject=${route.subjectId}` : ''}`;
    case 'quiz-session':
      return `/quiz/${route.quizId}`;
  }
}

/**
 * Attempt to parse a URL path into an AppRoute.
 * Returns null if the path does not match a known route pattern.
 */
function urlToRoute(path: string, search: string): AppRoute | null {
  const url = new URL(path + search, window.location.origin);

  // /materials/:materialId
  const materialMatch = url.pathname.match(/^\/materials\/([^/]+)$/);
  if (materialMatch) {
    const tab = (url.searchParams.get('tab') as 'read' | 'quiz' | 'manage') ?? 'read';
    const subjectId = url.searchParams.get('subject') ?? undefined;
    return { kind: 'workspace', workspace: 'material', materialId: materialMatch[1], activeTab: tab, subjectId };
  }

  // /subjects/:subjectId
  const subjectMatch = url.pathname.match(/^\/subjects\/([^/]+)$/);
  if (subjectMatch) {
    const tab = (url.searchParams.get('tab') as 'materials' | 'quiz') ?? 'materials';
    return { kind: 'subject', subjectId: subjectMatch[1], activeTab: tab };
  }

  // /quiz/:quizId
  const quizMatch = url.pathname.match(/^\/quiz\/([^/]+)$/);
  if (quizMatch) {
    return { kind: 'quiz-session', quizId: quizMatch[1], materialIds: [], returnTo: { kind: 'library' } };
  }

  // /terms
  if (url.pathname === '/terms') {
    return { kind: 'terms' };
  }

  // / (library)
  if (url.pathname === '/' || url.pathname === '') {
    return { kind: 'library' };
  }

  return null;
}

export default function AppShell() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    const parsed = urlToRoute(window.location.pathname, window.location.search);
    return parsed ?? { kind: 'library' };
  });

  const touchMutation = useTouchMaterial();

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
      : undefined;

  return (
    <div {...stylex.props(styles.shell)}>
      <div {...stylex.props(styles.rail)}>
        <AppSidebar
          subjectId={routeSubjectId}
          materialId={routeMaterialId}
          isLibrary={currentRoute.kind === 'library'}
          isTerms={currentRoute.kind === 'terms'}
          onNavigate={navigate}
        />
      </div>
      <main {...stylex.props(styles.main)}>
        {currentRoute.kind === 'library' && (
          <LibraryScreen
            onOpenMaterial={handleOpenMaterial}
            onOpenSubject={handleOpenSubject}
            onStartQuiz={handleStartQuiz}
            onManage={handleManageQuiz}
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
        {currentRoute.kind === 'quiz-session' && (
          <QuizScreen
            quizId={currentRoute.quizId}
            materialIds={currentRoute.materialIds}
            quizIds={currentRoute.quizIds}
            onExit={handleExitQuiz}
          />
        )}
      </main>
    </div>
  );
}
