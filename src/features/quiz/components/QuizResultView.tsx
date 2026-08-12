import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import * as stylex from '@stylexjs/stylex';
import { RotateCcw, CheckCircle2, XCircle, LayoutGrid, Home } from 'lucide-react';
import type { Question } from '../../../domain/quiz/Question';
import type { QuizResult } from '../../../domain/quiz/AssessmentService';
import { Button } from '../../../shared/ui/Button/Button';

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
    scoreCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: 32,
        backgroundColor: 'var(--color-background-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        textAlign: 'center',
    },
    scorePercent: {
        fontSize: 48,
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    scoreLabel: {
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
    scoreStats: {
        display: 'flex',
        gap: 24,
        fontSize: 13,
        color: 'var(--color-text-secondary)',
    },
    statCorrect: {
        color: 'var(--color-success)',
        fontWeight: 600,
    },
    statIncorrect: {
        color: 'var(--color-error)',
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
        backgroundColor: 'var(--color-background-surface)',
        border: '1px solid var(--color-border)',
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
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    reviewExplanation: {
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        margin: 0,
        lineHeight: 1.4,
    },
    actions: {
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
});

interface QuizResultViewProps {
    result: QuizResult;
    questions: Question[];
    onRetake: () => void;
    onReturnToOverview?: () => void;
    onExit: () => void;
}

/**
 * Pure presentation component for post-session summary.
 * Displays QuizScore metrics, question review list, and retake actions.
 */
export function QuizResultView({ result, questions, onRetake, onReturnToOverview, onExit }: QuizResultViewProps) {
    const { score, answers } = result;
    const answerMap = new Map(answers.map((a) => [a.questionId, a]));

    // ── Animated score count-up ────────────────────────────────────
    const [displayedScore, setDisplayedScore] = useState(0);
    const reviewListRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        const target = score.percentage;
        const scoreObj = { value: 0 };

        gsap.to(scoreObj, {
            value: target,
            duration: 1.2,
            ease: 'power3.out',
            overwrite: 'auto',
            onUpdate: () => {
                setDisplayedScore(Math.round(scoreObj.value));
            },
        });
    }, { dependencies: [score.percentage] });

    // ── Staggered entrance for review items and actions ────────────
    useGSAP(() => {
        if (reviewListRef.current) {
            const items = reviewListRef.current.querySelectorAll('[data-animate="stagger-review"]');
            if (items.length > 0) {
                gsap.fromTo(
                    items,
                    { opacity: 0, y: 16 },
                    { opacity: 1, y: 0, stagger: 0.06, duration: 0.35, ease: 'power2.out', delay: 0.4, overwrite: 'auto' },
                );
            }
        }
        if (actionsRef.current) {
            gsap.fromTo(
                actionsRef.current.children,
                { opacity: 0, y: 12 },
                { opacity: 1, y: 0, stagger: 0.08, duration: 0.3, ease: 'power2.out', delay: 0.6, overwrite: 'auto' },
            );
        }
    }, { dependencies: [questions.length] });

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.scoreCard)}>
                <p {...stylex.props(styles.scorePercent)}>{displayedScore}%</p>
                <p {...stylex.props(styles.scoreLabel)}>
                    {score.earnedPoints} / {score.maxPoints} points earned
                </p>
                <div {...stylex.props(styles.scoreStats)}>
                    <span {...stylex.props(styles.statCorrect)}>{score.correctAnswers} correct</span>
                    <span {...stylex.props(styles.statIncorrect)}>{score.incorrectAnswers} incorrect</span>
                </div>
            </div>

            <div ref={reviewListRef} {...stylex.props(styles.reviewList)}>
                {questions.map((q) => {
                    const answer = answerMap.get(q.id);
                    const isCorrect = answer?.isCorrect ?? false;
                    return (
                        <div key={q.id} data-animate="stagger-review" {...stylex.props(styles.reviewItem)}>
                            <div {...stylex.props(styles.reviewIcon)}>
                                {isCorrect ? (
                                    <CheckCircle2 size={18} color="var(--color-success)" />
                                ) : (
                                    <XCircle size={18} color="var(--color-error)" />
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

            <div ref={actionsRef} {...stylex.props(styles.actions)}>
                <Button
                    label="Retake quiz"
                    variant="secondary"
                    icon={<RotateCcw size={16} />}
                    onClick={onRetake}
                >
                    Retake Quiz
                </Button>
                {onReturnToOverview && (
                    <Button
                        label="Quiz overview"
                        variant="secondary"
                        icon={<LayoutGrid size={16} />}
                        onClick={onReturnToOverview}
                    >
                        Quiz Overview
                    </Button>
                )}
                <Button
                    label="Return to library"
                    variant="primary"
                    icon={<Home size={16} />}
                    onClick={onExit}
                >
                    Return to Library
                </Button>
            </div>
        </div>
    );
}
