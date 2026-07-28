import * as stylex from '@stylexjs/stylex';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import type { Question } from '../../../domain/quiz/Question';
import type { QuizMode } from '../../../domain/quiz/QuizMode';
import type { AnswerValue } from './QuestionRenderer';
import { QuestionRenderer } from './QuestionRenderer';
import { Button } from '../../../shared/ui/Button';

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        maxWidth: 720,
        width: '100%',
        margin: '0 auto',
        padding: '24px 16px',
        boxSizing: 'border-box',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progress: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
    },
    modeBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--color-accent)',
        backgroundColor: 'var(--color-accent-muted)',
        borderRadius: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    progressBar: {
        height: 4,
        backgroundColor: 'var(--color-border)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: 'var(--color-accent)',
        borderRadius: 2,
        transition: 'width 0.3s ease',
    },
    questionCard: {
        padding: 24,
        backgroundColor: 'var(--color-background-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
    },
    explanation: {
        marginTop: 16,
        padding: '12px 16px',
        backgroundColor: 'var(--color-success-muted)',
        border: '1px solid #bbf7d0',
        borderRadius: 8,
        fontSize: 13,
        color: '#166534',
        lineHeight: 1.5,
    },
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    navGroup: {
        display: 'flex',
        gap: 8,
    },
});

interface QuizViewProps {
    question: Question;
    currentIndex: number;
    totalQuestions: number;
    answeredCount: number;
    isLastQuestion: boolean;
    mode: QuizMode;
    answerValue: AnswerValue;
    onAnswer: (questionId: string, value: AnswerValue) => void;
    onNext: () => void;
    onPrev: () => void;
    onSubmit: () => void;
}

/**
 * Pure presentation component for the active quiz player.
 * Contains zero grading or persistence logic.
 */
export function QuizView({
    question,
    currentIndex,
    totalQuestions,
    answeredCount,
    isLastQuestion,
    mode,
    answerValue,
    onAnswer,
    onNext,
    onPrev,
    onSubmit,
}: QuizViewProps) {
    const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.header)}>
                <span {...stylex.props(styles.progress)}>
                    Question {currentIndex + 1} of {totalQuestions} · {answeredCount} answered
                </span>
                <span {...stylex.props(styles.modeBadge)}>{mode}</span>
            </div>

            <div {...stylex.props(styles.progressBar)}>
                <div {...stylex.props(styles.progressFill)} style={{ width: `${progressPercent}%` }} />
            </div>

            <div {...stylex.props(styles.questionCard)}>
                <QuestionRenderer
                    question={question}
                    value={answerValue}
                    onChange={(v) => onAnswer(question.id, v)}
                />
                {mode === 'practice' && question.explanation && (
                    <div {...stylex.props(styles.explanation)}>
                        {question.explanation}
                    </div>
                )}
            </div>

            <div {...stylex.props(styles.nav)}>
                <Button
                    label="Previous question"
                    variant="secondary"
                    icon={<ChevronLeft size={16} />}
                    onClick={onPrev}
                >
                    Previous
                </Button>
                <div {...stylex.props(styles.navGroup)}>
                    {isLastQuestion ? (
                        <Button
                            label="Submit quiz"
                            variant="primary"
                            icon={<CheckCircle size={16} />}
                            onClick={onSubmit}
                        >
                            Submit Quiz
                        </Button>
                    ) : (
                        <Button
                            label="Next question"
                            variant="primary"
                            icon={<ChevronRight size={16} />}
                            onClick={onNext}
                        >
                            Next
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
