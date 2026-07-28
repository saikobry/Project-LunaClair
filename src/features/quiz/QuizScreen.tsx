import type { ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ArrowLeft, AlertTriangle, Inbox, Layers } from 'lucide-react';
import type { AnswerValue } from './components/QuestionRenderer';
import { useQuizSessionFlow } from './hooks/useQuizSessionFlow';
import { QuizView } from './components/QuizView';
import { QuizResultView } from './components/QuizResultView';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button';
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
    onExit: () => void;
    /** When true, renders without Page shell (embedded in workspace tab). */
    embedded?: boolean;
}

interface QuizShellProps {
    embedded: boolean;
    title: string;
    actions?: ReactNode;
    children: ReactNode;
}

/** Stable layout wrapper — hoisted to module scope so React preserves its subtree across renders. */
function QuizShell({ embedded, title, actions, children }: QuizShellProps) {
    if (embedded) return <>{children}</>;
    return <Page title={title} actions={actions}>{children}</Page>;
}

/**
 * Feature orchestrator screen for the quiz player.
 * Accepts workspace-oriented route params (quizId, materialIds).
 */
export default function QuizScreen({ quizId, materialIds, onExit, embedded = false }: QuizScreenProps) {
    const { showToast } = useToast();
    // Build a launch request from the workspace-oriented params
    const launchRequest = {
        materialId: materialIds[0] ?? '',
        quizId: quizId || undefined,
        source: 'reader' as const,
    };

    const flow = useQuizSessionFlow(launchRequest);

    const isUnified = materialIds.length > 1;

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
                        Unified Quiz · {materialIds.length} chapters
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

    if (flow.flowState === 'empty') {
        return (
            <QuizShell embedded={embedded} title={shellTitle} actions={backAction}>
                {isUnified && (
                    <div {...stylex.props(styles.banner)}>
                        <Layers size={16} />
                        Unified Quiz · {materialIds.length} chapters
                    </div>
                )}
                <div {...stylex.props(styles.center)}>
                    <div {...stylex.props(styles.icon)}>
                        <Inbox size={48} />
                    </div>
                    <h2 {...stylex.props(styles.title)}>No quizzes available</h2>
                    <p {...stylex.props(styles.subtext)}>
                        This material doesn't have any quizzes yet.
                    </p>
                </div>
            </QuizShell>
        );
    }

    if (flow.flowState === 'completed' && flow.result) {
        return (
            <QuizShell embedded={embedded} title={shellTitle} actions={backAction}>
                <QuizResultView
                    result={flow.result}
                    questions={flow.questions}
                    onRetake={flow.retake}
                    onExit={onExit}
                />
            </QuizShell>
        );
    }

    // flowState === 'ready'
    if (!flow.currentQuestion) return null;

    const answerValue: AnswerValue = flow.answers.get(flow.currentQuestion.id) ?? '';

    return (
        <QuizShell embedded={embedded} title={shellTitle} actions={backAction}>
            {isUnified && (
                <div {...stylex.props(styles.banner)}>
                    <Layers size={16} />
                    Unified Quiz · {materialIds.length} chapters
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
                onSubmit={() => { flow.submit(); showToast('Quiz submitted! Scoring results below.', { intent: 'success' }); }}
            />
        </QuizShell>
    );
}
