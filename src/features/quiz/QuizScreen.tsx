import { useState, useMemo, type ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ArrowLeft, AlertTriangle, Inbox, Layers } from 'lucide-react';
import type { AnswerValue } from './components/QuestionRenderer';
import type { QuizLaunchRequest, QuizFlowState } from './types/quizFeature.types';
import type { Question } from '../../domain/quiz/models/Question';
import { useQuizSessionFlow } from './hooks/session/useQuizSessionFlow';
import { useQuestions } from './hooks/queries/useQuestions';
import { QuizView } from './components/QuizView';
import { QuizResultView } from './components/QuizResultView';
import { QuizStartView } from './components/QuizStartView';
import { Page } from '../../shared/ui/Page/Page';
import { Button } from '../../shared/ui/Button/Button';
import { QuestionSkeleton } from './components/QuestionSkeleton';
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
  unifiedQuizCount?: number;
  children: ReactNode;
}

function QuizShell({ embedded, title, actions, unifiedQuizCount = 0, children }: QuizShellProps) {
  const banner = unifiedQuizCount > 0 ? (
    <div {...stylex.props(styles.banner)}>
      <Layers size={16} />
      Unified Quiz · {unifiedQuizCount} quizzes
    </div>
  ) : null;

  if (embedded) {
    return (
      <>
        {banner}
        {children}
      </>
    );
  }

  return (
    <Page title={title} actions={actions}>
      {banner}
      {children}
    </Page>
  );
}

function QuizNotice({ icon, title, subtext }: { icon: ReactNode; title: string; subtext: string }) {
  return (
    <div {...stylex.props(styles.center)}>
      <div {...stylex.props(styles.icon)}>{icon}</div>
      <h2 {...stylex.props(styles.title)}>{title}</h2>
      <p {...stylex.props(styles.subtext)}>{subtext}</p>
    </div>
  );
}

function QuizErrorNotice({ message }: { message?: string }) {
  return (
    <QuizNotice
      icon={<AlertTriangle size={48} />}
      title="Something went wrong"
      subtext={message ?? 'An unexpected error occurred while loading the quiz.'}
    />
  );
}

function quizShellTitle(flowState: QuizFlowState): string {
  if (flowState === 'completed') return 'Quiz Results';
  return 'Quiz';
}

function startViewTitle(isUnified: boolean, questions: Question[]): string {
  if (isUnified) return 'Unified Knowledge Check';
  if (questions[0]?.prompt) return 'Knowledge Check';
  return 'Material Quiz';
}

function buildLaunchRequest(
  quizIds: string[] | undefined,
  currentQuizId: string,
  materialId: string,
  source: 'reader' | 'library',
): QuizLaunchRequest {
  if (quizIds && quizIds.length > 0) {
    return { type: 'quizzes', quizIds, source };
  }
  return { type: 'quiz', quizId: currentQuizId, materialId, source };
}

function firstMaterialId(materialIds: string[]): string {
  return materialIds[0] ?? '';
}

function currentQuizIdFor(activeQuizId: string | undefined, quizId: string): string {
  return activeQuizId ?? quizId;
}

function unifiedCountFor(quizIds: string[] | undefined): number {
  return quizIds?.length ?? 0;
}

function answerValueFor(answers: Map<string, AnswerValue>, questionId: string): AnswerValue {
  return answers.get(questionId) ?? '';
}

function resolveSource(embedded: boolean): 'reader' | 'library' {
  if (embedded) return 'reader';
  return 'library';
}

function quizExitAction(embedded: boolean, onExit: () => void): ReactNode {
  if (embedded) return undefined;
  return (
    <Button
      label="Exit quiz"
      variant="secondary"
      icon={<ArrowLeft size={16} />}
      onClick={onExit}
    >
      Exit Quiz
    </Button>
  );
}

function QuizEmptyNotice({ hasArchivedOnly }: { hasArchivedOnly: boolean }) {
  return (
    <QuizNotice
      icon={<Inbox size={48} />}
      title="No quizzes available"
      subtext={hasArchivedOnly
        ? 'All quizzes are archived. Restore one from Quiz Management to try again.'
        : "This material doesn't have any quizzes yet."}
    />
  );
}

export default function QuizScreen({ quizId, materialIds, quizIds, onExit, onOpenManagement, embedded = false }: QuizScreenProps) {
  const { showToast } = useToast();
  const [activeQuizId, setActiveQuizId] = useState<string | undefined>(quizId || undefined);
  const [isStarted, setIsStarted] = useState(false);

  const materialId = firstMaterialId(materialIds);

  const currentQuizId = currentQuizIdFor(activeQuizId, quizId);
  const source = resolveSource(embedded);

  // Build the appropriate launch request based on presence of quizIds
  const launchRequest: QuizLaunchRequest = useMemo(
    () => buildLaunchRequest(quizIds, currentQuizId, materialId, source),
    [quizIds, currentQuizId, materialId, source],
  );

  const { questions: bankQuestions } = useQuestions(materialId);

  const flow = useQuizSessionFlow(launchRequest);
  const isUnified = launchRequest.type === 'quizzes';

  // Filter out archived quizzes for display purposes
  const activeQuizzes = useMemo(
    () => flow.sourceQuizzes.filter((q) => q.status !== 'archived'),
    [flow.sourceQuizzes],
  );

  const backAction = quizExitAction(embedded, onExit);

  const unifiedQuizCount = unifiedCountFor(quizIds);
  const shellTitle = quizShellTitle(flow.flowState);

  if (flow.flowState === 'loading') {
    return (
      <QuizShell embedded={embedded} title={shellTitle} actions={backAction} unifiedQuizCount={unifiedQuizCount}>
        <QuestionSkeleton />
      </QuizShell>
    );
  }

  if (flow.flowState === 'error') {
    return (
      <QuizShell embedded={embedded} title={shellTitle} actions={backAction} unifiedQuizCount={unifiedQuizCount}>
        <QuizErrorNotice message={flow.error?.message} />
      </QuizShell>
    );
  }

  if (flow.flowState === 'empty' || (flow.flowState === 'ready' && activeQuizzes.length === 0)) {
    return (
      <QuizShell embedded={embedded} title={shellTitle} actions={backAction} unifiedQuizCount={unifiedQuizCount}>
        <QuizEmptyNotice hasArchivedOnly={flow.sourceQuizzes.some((q) => q.status === 'archived')} />
      </QuizShell>
    );
  }

  // 1. Render Start Screen Overlay before beginning active session
  if (!isStarted) {
    return (
      <QuizShell embedded={embedded} title={shellTitle} actions={backAction} unifiedQuizCount={unifiedQuizCount}>
        <QuizStartView
          title={startViewTitle(isUnified, flow.questions)}
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
      <QuizShell embedded={embedded} title={shellTitle} actions={backAction} unifiedQuizCount={unifiedQuizCount}>
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
  const answerValue: AnswerValue = answerValueFor(flow.answers, flow.currentQuestion.id);

  return (
    <QuizShell embedded={embedded} title={shellTitle} actions={backAction} unifiedQuizCount={unifiedQuizCount}>
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
