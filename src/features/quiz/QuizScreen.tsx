import { useState, useMemo, type ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ArrowLeft, AlertTriangle, Inbox, Layers } from 'lucide-react';
import type { AnswerValue } from './components/QuestionRenderer';
import type { QuizLaunchRequest } from './types/quizFeature.types';
import { useQuizSessionFlow } from './hooks/session/useQuizSessionFlow';
import { useQuestions } from './hooks/queries/useQuestions';
import { QuizView } from './components/QuizView';
import { QuizResultView } from './components/QuizResultView';
import { QuizStartView } from './components/QuizStartView';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button/Button';
import { QuestionSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import { useToast } from '../../app/providers/ToastContext';

const styles = stylex.create({
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '64px 24px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
  icon: {
    color: 'var(--color-text-disabled)',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  subtext: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    background: 'var(--color-accent-muted)',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
    color: 'var(--color-accent)',
    fontWeight: 500,
  },
});

interface QuizScreenProps {
  quizId: string;
  materialIds: string[];
  quizIds?: string[];
  onExit: () => void;
  onOpenManagement?: () => void;
  /** When true, renders without Page shell (embedded in workspace tab). */
  embedded?: boolean;
}

interface QuizShellProps {
  embedded: boolean;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

function QuizShell({ embedded, title, actions, children }: QuizShellProps) {
  if (embedded) return <>{children}</>;
  return <Page title={title} actions={actions}>{children}</Page>;
}

export default function QuizScreen({ quizId, materialIds, quizIds, onExit, onOpenManagement, embedded = false }: QuizScreenProps) {
  const { showToast } = useToast();
  const [activeQuizId, setActiveQuizId] = useState<string | undefined>(quizId || undefined);
  const [isStarted, setIsStarted] = useState(false);

  const materialId = materialIds[0] ?? '';

  const currentQuizId = activeQuizId ?? quizId;
  const source = embedded ? 'reader' : 'library';

  // Build the appropriate launch request based on presence of quizIds
  const launchRequest: QuizLaunchRequest = useMemo(() => {
    if (quizIds && quizIds.length > 0) {
      return { type: 'quizzes', quizIds, source };
    }
    return { type: 'quiz', quizId: currentQuizId, materialId, source };
  }, [quizIds, currentQuizId, materialId, source]);

  const { questions: bankQuestions } = useQuestions(materialId);

  const flow = useQuizSessionFlow(launchRequest);
  const isUnified = launchRequest.type === 'quizzes';

  // Filter out archived quizzes for display purposes
  const activeQuizzes = useMemo(
    () => flow.sourceQuizzes.filter((q) => q.status !== 'archived'),
    [flow.sourceQuizzes],
  );

  const backAction = embedded ? undefined : (
    <Button
      label="Exit quiz"
      variant="secondary"
      icon={<ArrowLeft size={16} />}
      onClick={onExit}
    >
      Exit Quiz
    </Button>
  );

  const shellTitle = flow.flowState === 'completed' ? 'Quiz Results' : 'Quiz';

  if (flow.flowState === 'loading') {
    return (
      <QuizShell embedded={embedded} title={shellTitle} actions={backAction}>
        {isUnified && (
          <div {...stylex.props(styles.banner)}>
            <Layers size={16} />
            Unified Quiz · {quizIds!.length} quizzes
          </div>
        )}
        <QuestionSkeleton />
      </QuizShell>
    );
  }

  if (flow.flowState === 'error') {
    return (
      <QuizShell embedded={embedded} title={shellTitle} actions={backAction}>
        <div {...stylex.props(styles.center)}>
          <div {...stylex.props(styles.icon)}>
            <AlertTriangle size={48} />
          </div>
          <h2 {...stylex.props(styles.title)}>Something went wrong</h2>
          <p {...stylex.props(styles.subtext)}>
            {flow.error?.message ?? 'An unexpected error occurred while loading the quiz.'}
          </p>
        </div>
      </QuizShell>
    );
  }

  if (flow.flowState === 'empty' || (flow.flowState === 'ready' && activeQuizzes.length === 0)) {
    return (
      <QuizShell embedded={embedded} title={shellTitle} actions={backAction}>
        {isUnified && (
          <div {...stylex.props(styles.banner)}>
            <Layers size={16} />
            Unified Quiz · {quizIds!.length} quizzes
          </div>
        )}
        <div {...stylex.props(styles.center)}>
          <div {...stylex.props(styles.icon)}>
            <Inbox size={48} />
          </div>
          <h2 {...stylex.props(styles.title)}>No quizzes available</h2>
          <p {...stylex.props(styles.subtext)}>
            {flow.sourceQuizzes.some((q) => q.status === 'archived')
              ? 'All quizzes are archived. Restore one from Quiz Management to try again.'
              : "This material doesn't have any quizzes yet."}
          </p>
        </div>
      </QuizShell>
    );
  }

  // 1. Render Start Screen Overlay before beginning active session
  if (!isStarted) {
    return (
      <QuizShell embedded={embedded} title={shellTitle} actions={backAction}>
        {isUnified && (
          <div {...stylex.props(styles.banner)}>
            <Layers size={16} />
            Unified Quiz · {quizIds!.length} quizzes
          </div>
        )}
        <QuizStartView
          title={isUnified ? 'Unified Knowledge Check' : (flow.questions[0]?.prompt ? 'Knowledge Check' : 'Material Quiz')}
          quizzes={activeQuizzes}
          allQuestions={bankQuestions.length > 0 ? bankQuestions : flow.questions}
          isUnified={isUnified}
          onStartQuiz={(selectedId) => {
            if (selectedId) setActiveQuizId(selectedId);
            setIsStarted(true);
          }}
          onOpenManagement={onOpenManagement}
        />
      </QuizShell>
    );
  }

  // 2. Render Completed Results View when finished
  if (flow.flowState === 'completed' && flow.result) {
    return (
      <QuizShell embedded={embedded} title={shellTitle} actions={backAction}>
        {isUnified && (
          <div {...stylex.props(styles.banner)}>
            <Layers size={16} />
            Unified Quiz · {quizIds!.length} quizzes
          </div>
        )}
        <QuizResultView
          result={flow.result}
          questions={flow.questions}
          onRetake={() => {
            flow.retake();
            setIsStarted(true);
          }}
          onReturnToOverview={() => {
            setActiveQuizId(undefined);
            flow.retake();
            setIsStarted(false);
          }}
          onExit={onExit}
        />
      </QuizShell>
    );
  }

  // 3. Active question session
  if (!flow.currentQuestion) return null;
  const answerValue: AnswerValue = flow.answers.get(flow.currentQuestion.id) ?? '';

  return (
    <QuizShell embedded={embedded} title={shellTitle} actions={backAction}>
      {isUnified && (
        <div {...stylex.props(styles.banner)}>
          <Layers size={16} />
          Unified Quiz · {quizIds!.length} quizzes
        </div>
      )}
      <QuizView
        question={flow.currentQuestion}
        currentIndex={flow.currentIndex}
        totalQuestions={flow.totalQuestions}
        answeredCount={flow.answeredCount}
        isLastQuestion={flow.isLastQuestion}
        mode={flow.mode}
        answerValue={answerValue}
        onAnswer={flow.setAnswer}
        onNext={flow.goNext}
        onPrev={flow.goPrev}
        onSubmit={() => {
          flow.submit();
          showToast('Quiz submitted! Scoring results below.', { intent: 'success' });
        }}
      />
    </QuizShell>
  );
}
