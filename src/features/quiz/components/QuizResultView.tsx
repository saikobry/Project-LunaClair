import * as stylex from '@stylexjs/stylex';
import { RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import type { Question } from '../../../domain/quiz/Question';
import type { QuizResult } from '../../../domain/quiz/AssessmentService';
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
    },
    scoreCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: 32,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e4e7',
        borderRadius: 12,
        textAlign: 'center',
    },
    scorePercent: {
        fontSize: 48,
        fontWeight: 700,
        color: '#08060d',
        margin: 0,
    },
    scoreLabel: {
        fontSize: 14,
        color: '#6b6375',
        margin: 0,
    },
    scoreStats: {
        display: 'flex',
        gap: 24,
        fontSize: 13,
        color: '#6b6375',
    },
    statCorrect: {
        color: '#16a34a',
        fontWeight: 600,
    },
    statIncorrect: {
        color: '#dc2626',
        fontWeight: 600,
    },
    reviewList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    reviewItem: {
        display: 'flex',
        gap: 12,
        padding: 16,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e4e7',
        borderRadius: 10,
        alignItems: 'flex-start',
    },
    reviewIcon: {
        flexShrink: 0,
        marginTop: 2,
    },
    reviewContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        flex: 1,
    },
    reviewPrompt: {
        fontSize: 14,
        fontWeight: 500,
        color: '#08060d',
        margin: 0,
    },
    reviewExplanation: {
        fontSize: 13,
        color: '#6b6375',
        margin: 0,
        lineHeight: 1.4,
    },
    actions: {
        display: 'flex',
        justifyContent: 'center',
        gap: 12,
    },
});

interface QuizResultViewProps {
    result: QuizResult;
    questions: Question[];
    onRetake: () => void;
    onExit: () => void;
}

/**
 * Pure presentation component for post-session summary.
 * Displays QuizScore metrics, question review list, and retake actions.
 */
export function QuizResultView({ result, questions, onRetake, onExit }: QuizResultViewProps) {
    const { score, answers } = result;
    const answerMap = new Map(answers.map((a) => [a.questionId, a]));

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.scoreCard)}>
                <p {...stylex.props(styles.scorePercent)}>{score.percentage}%</p>
                <p {...stylex.props(styles.scoreLabel)}>
                    {score.earnedPoints} / {score.maxPoints} points earned
                </p>
                <div {...stylex.props(styles.scoreStats)}>
                    <span {...stylex.props(styles.statCorrect)}>{score.correctAnswers} correct</span>
                    <span {...stylex.props(styles.statIncorrect)}>{score.incorrectAnswers} incorrect</span>
                </div>
            </div>

            <div {...stylex.props(styles.reviewList)}>
                {questions.map((q) => {
                    const answer = answerMap.get(q.id);
                    const isCorrect = answer?.isCorrect ?? false;
                    return (
                        <div key={q.id} {...stylex.props(styles.reviewItem)}>
                            <div {...stylex.props(styles.reviewIcon)}>
                                {isCorrect ? (
                                    <CheckCircle2 size={18} color="#16a34a" />
                                ) : (
                                    <XCircle size={18} color="#dc2626" />
                                )}
                            </div>
                            <div {...stylex.props(styles.reviewContent)}>
                                <p {...stylex.props(styles.reviewPrompt)}>{q.prompt}</p>
                                {q.explanation && (
                                    <p {...stylex.props(styles.reviewExplanation)}>{q.explanation}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div {...stylex.props(styles.actions)}>
                <Button
                    label="Retake quiz"
                    variant="secondary"
                    icon={<RotateCcw size={16} />}
                    onClick={onRetake}
                >
                    Retake Quiz
                </Button>
                <Button
                    label="Exit quiz"
                    variant="primary"
                    onClick={onExit}
                >
                    Done
                </Button>
            </div>
        </div>
    );
}
