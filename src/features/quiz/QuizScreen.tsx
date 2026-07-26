import * as stylex from '@stylexjs/stylex';
import { ArrowLeft, AlertTriangle, Inbox } from 'lucide-react';
import type { QuizLaunchRequest } from './types/quizFeature.types';
import type { AnswerValue } from './components/QuestionRenderer';
import { useQuizSessionFlow } from './hooks/useQuizSessionFlow';
import { QuizView } from './components/QuizView';
import { QuizResultView } from './components/QuizResultView';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button';

const styles = stylex.create({
    center: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '64px 24px',
        textAlign: 'center',
        color: '#6b6375',
    },
    icon: {
        color: '#9f95a9',
    },
    title: {
        fontSize: 18,
        fontWeight: 600,
        color: '#3d3548',
        margin: 0,
    },
    subtext: {
        fontSize: 14,
        color: '#6b6375',
        margin: 0,
    },
});

interface QuizScreenProps {
    launchRequest: QuizLaunchRequest;
    onExit: () => void;
}

/**
 * Feature orchestrator screen for the quiz player.
 * Dispatches rendering based on QuizFlowState.
 */
export default function QuizScreen({ launchRequest, onExit }: QuizScreenProps) {
    const flow = useQuizSessionFlow(launchRequest);

    const backAction = (
        <Button
            label="Exit quiz"
            variant="secondary"
            icon={<ArrowLeft size={16} />}
            onClick={onExit}
        >
            Exit Quiz
        </Button>
    );

    if (flow.flowState === 'loading') {
        return (
            <Page title="Quiz" actions={backAction}>
                <div {...stylex.props(styles.center)}>Loading quiz…</div>
            </Page>
        );
    }

    if (flow.flowState === 'error') {
        return (
            <Page title="Quiz" actions={backAction}>
                <div {...stylex.props(styles.center)}>
                    <div {...stylex.props(styles.icon)}>
                        <AlertTriangle size={48} />
                    </div>
                    <h2 {...stylex.props(styles.title)}>Something went wrong</h2>
                    <p {...stylex.props(styles.subtext)}>
                        {flow.error?.message ?? 'An unexpected error occurred while loading the quiz.'}
                    </p>
                </div>
            </Page>
        );
    }

    if (flow.flowState === 'empty') {
        return (
            <Page title="Quiz" actions={backAction}>
                <div {...stylex.props(styles.center)}>
                    <div {...stylex.props(styles.icon)}>
                        <Inbox size={48} />
                    </div>
                    <h2 {...stylex.props(styles.title)}>No quizzes available</h2>
                    <p {...stylex.props(styles.subtext)}>
                        This material doesn't have any quizzes yet.
                    </p>
                </div>
            </Page>
        );
    }

    if (flow.flowState === 'completed' && flow.result) {
        return (
            <Page title="Quiz Results" actions={backAction}>
                <QuizResultView
                    result={flow.result}
                    questions={flow.questions}
                    onRetake={flow.retake}
                    onExit={onExit}
                />
            </Page>
        );
    }

    // flowState === 'ready'
    if (!flow.currentQuestion) return null;

    const answerValue: AnswerValue = flow.answers.get(flow.currentQuestion.id) ?? '';

    return (
        <Page title="Quiz" actions={backAction}>
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
                onSubmit={flow.submit}
            />
        </Page>
    );
}
