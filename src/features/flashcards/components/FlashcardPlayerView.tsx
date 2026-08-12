import * as stylex from '@stylexjs/stylex';
import { useState, useEffect, useCallback } from 'react';
import { RotateCw, X, Check, HelpCircle, AlertCircle, Award } from 'lucide-react';
import type { Flashcard, FlashcardType } from '../../../domain/flashcards/Card';
import type { Rating } from '../../../domain/flashcards/scheduler';
import { Button } from '../../../shared/ui/Button/Button';

const TYPE_LABEL_MAP: Record<FlashcardType, string> = {
    multiple_choice: 'MULTIPLE CHOICE',
    multiple_select: 'MULTIPLE SELECT',
    true_false: 'TRUE / FALSE',
    identification: 'IDENTIFICATION',
    fill_in_blank: 'FILL IN THE BLANK',
};

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        maxWidth: 720,
        width: '100%',
        margin: '0 auto',
        padding: '16px',
        boxSizing: 'border-box',
    },
    headerRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 4px',
    },
    progressText: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
    },
    progressBarOuter: {
        width: '100%',
        height: 6,
        borderRadius: 999,
        backgroundColor: 'var(--color-background-muted)',
        overflow: 'hidden',
    },
    progressBarInner: {
        height: '100%',
        backgroundColor: 'var(--color-accent)',
        borderRadius: 999,
        transition: 'width 0.3s ease',
    },
    cardWrapper: {
        perspective: '1000px',
        width: '100%',
        minHeight: 340,
        cursor: 'pointer',
    },
    cardInner: {
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 340,
        borderRadius: 20,
        transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
        transformStyle: 'preserve-3d',
    },
    cardFlipped: {
        transform: 'rotateY(180deg)',
    },
    cardFace: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        minHeight: 340,
        borderRadius: 20,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        backgroundColor: 'var(--color-background-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        padding: '32px 28px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    cardFaceBack: {
        transform: 'rotateY(180deg)',
    },
    metaRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    badge: {
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
        padding: '3px 8px',
        borderRadius: 6,
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-secondary)',
    },
    typeBadge: {
        backgroundColor: 'var(--color-accent-muted)',
        color: 'var(--color-accent)',
        fontWeight: 600,
    },
    difficultyEasy: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        color: '#059669',
    },
    difficultyMedium: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        color: '#d97706',
    },
    difficultyHard: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        color: '#dc2626',
    },
    contentBox: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        flex: 1,
        padding: '20px 0',
        gap: 12,
    },
    promptText: {
        fontSize: 20,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        lineHeight: 1.5,
        margin: 0,
        whiteSpace: 'pre-line',
    },
    answerText: {
        fontSize: 20,
        fontWeight: 700,
        color: 'var(--color-accent)',
        lineHeight: 1.5,
        margin: 0,
    },
    explanationBox: {
        marginTop: 12,
        padding: 14,
        borderRadius: 12,
        backgroundColor: 'var(--color-background-muted)',
        border: '1px solid var(--color-border)',
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        textAlign: 'left',
        width: '100%',
        boxSizing: 'border-box',
    },
    explanationHeader: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        marginBottom: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    flipHint: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontSize: 13,
        color: 'var(--color-text-disabled)',
    },
    ratingBar: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        width: '100%',
        marginTop: 8,
    },
    ratingButton: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '12px 8px',
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-background-surface)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        ':hover': {
            transform: 'translateY(-2px)',
        },
    },
    ratingBtnAgain: {
        borderColor: 'rgba(239, 68, 68, 0.3)',
        color: '#dc2626',
        ':hover': {
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
        },
    },
    ratingBtnHard: {
        borderColor: 'rgba(245, 158, 11, 0.3)',
        color: '#d97706',
        ':hover': {
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
        },
    },
    ratingBtnGood: {
        borderColor: 'rgba(59, 130, 246, 0.3)',
        color: '#2563eb',
        ':hover': {
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
        },
    },
    ratingBtnEasy: {
        borderColor: 'rgba(16, 185, 129, 0.3)',
        color: '#059669',
        ':hover': {
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
        },
    },
    ratingLabel: {
        fontSize: 13,
        fontWeight: 700,
    },
    ratingKey: {
        fontSize: 10,
        fontWeight: 600,
        opacity: 0.6,
        padding: '1px 5px',
        borderRadius: 4,
        backgroundColor: 'var(--color-background-muted)',
    },
});

interface FlashcardPlayerViewProps {
    deck: Flashcard[];
    currentIndex: number;
    onRating: (card: Flashcard, rating: Rating) => void;
    onExit: () => void;
}

export function FlashcardPlayerView({
    deck,
    currentIndex,
    onRating,
    onExit,
}: FlashcardPlayerViewProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const card = deck[currentIndex];

    // Reset flip state when card index changes
    useEffect(() => {
        setIsFlipped(false);
    }, [currentIndex]);

    const handleFlip = useCallback(() => {
        setIsFlipped((prev) => !prev);
    }, []);

    const handleRate = useCallback(
        (rating: Rating) => {
            if (!card) return;
            onRating(card, rating);
        },
        [card, onRating]
    );

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                if (!isFlipped) {
                    handleFlip();
                }
            } else if (isFlipped) {
                if (e.key === '1') handleRate('again');
                if (e.key === '2') handleRate('hard');
                if (e.key === '3') handleRate('good');
                if (e.key === '4') handleRate('easy');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFlipped, handleFlip, handleRate]);

    if (!card) return null;

    const total = deck.length;
    const progressPct = ((currentIndex + 1) / total) * 100;

    const difficultyStyle =
        card.difficulty === 'easy'
            ? styles.difficultyEasy
            : card.difficulty === 'hard'
            ? styles.difficultyHard
            : styles.difficultyMedium;

    return (
        <div {...stylex.props(styles.container)}>
            {/* Header */}
            <div {...stylex.props(styles.headerRow)}>
                <span {...stylex.props(styles.progressText)}>
                    Card {currentIndex + 1} of {total}
                </span>
                <Button
                    label="Exit session"
                    variant="ghost"
                    icon={<X size={16} />}
                    onClick={onExit}
                >
                    Exit
                </Button>
            </div>

            <div {...stylex.props(styles.progressBarOuter)}>
                <div
                    {...stylex.props(styles.progressBarInner)}
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            {/* 3D Flip Card */}
            <div {...stylex.props(styles.cardWrapper)} onClick={handleFlip}>
                <div
                    {...stylex.props(
                        styles.cardInner,
                        isFlipped && styles.cardFlipped
                    )}
                >
                    {/* Front Face */}
                    <div {...stylex.props(styles.cardFace)}>
                        <div {...stylex.props(styles.metaRow)}>
                            <span {...stylex.props(styles.badge, difficultyStyle)}>
                                {card.difficulty}
                            </span>
                            <span {...stylex.props(styles.badge, styles.typeBadge)}>
                                {TYPE_LABEL_MAP[card.type] ?? card.type}
                            </span>
                            {card.tags?.map((t) => (
                                <span key={t} {...stylex.props(styles.badge)}>
                                    #{t}
                                </span>
                            ))}
                        </div>


                        <div {...stylex.props(styles.contentBox)}>
                            <p {...stylex.props(styles.promptText)}>{card.front}</p>
                        </div>

                        <div {...stylex.props(styles.flipHint)}>
                            <RotateCw size={14} />
                            <span>Click or press Space to reveal answer</span>
                        </div>
                    </div>

                    {/* Back Face */}
                    <div {...stylex.props(styles.cardFace, styles.cardFaceBack)}>
                        <div {...stylex.props(styles.metaRow)}>
                            <span {...stylex.props(styles.badge)}>Answer</span>
                        </div>

                        <div {...stylex.props(styles.contentBox)}>
                            <p {...stylex.props(styles.answerText)}>{card.back}</p>
                            {card.explanation && (
                                <div {...stylex.props(styles.explanationBox)}>
                                    <div {...stylex.props(styles.explanationHeader)}>
                                        <HelpCircle size={13} /> Explanation
                                    </div>
                                    <div>{card.explanation}</div>
                                </div>
                            )}
                        </div>

                        <div {...stylex.props(styles.flipHint)}>
                            <span>Rate recall quality below to schedule next review</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rating Bar (active when flipped) */}
            {isFlipped ? (
                <div {...stylex.props(styles.ratingBar)}>
                    <button
                        {...stylex.props(styles.ratingButton, styles.ratingBtnAgain)}
                        onClick={() => handleRate('again')}
                    >
                        <AlertCircle size={18} />
                        <span {...stylex.props(styles.ratingLabel)}>Again</span>
                        <span {...stylex.props(styles.ratingKey)}>Key 1</span>
                    </button>

                    <button
                        {...stylex.props(styles.ratingButton, styles.ratingBtnHard)}
                        onClick={() => handleRate('hard')}
                    >
                        <RotateCw size={18} />
                        <span {...stylex.props(styles.ratingLabel)}>Hard</span>
                        <span {...stylex.props(styles.ratingKey)}>Key 2</span>
                    </button>

                    <button
                        {...stylex.props(styles.ratingButton, styles.ratingBtnGood)}
                        onClick={() => handleRate('good')}
                    >
                        <Check size={18} />
                        <span {...stylex.props(styles.ratingLabel)}>Good</span>
                        <span {...stylex.props(styles.ratingKey)}>Key 3</span>
                    </button>

                    <button
                        {...stylex.props(styles.ratingButton, styles.ratingBtnEasy)}
                        onClick={() => handleRate('easy')}
                    >
                        <Award size={18} />
                        <span {...stylex.props(styles.ratingLabel)}>Easy</span>
                        <span {...stylex.props(styles.ratingKey)}>Key 4</span>
                    </button>
                </div>
            ) : (
                <div style={{ marginTop: 8 }}>
                    <Button
                        label="Flip Card"
                        variant="secondary"
                        icon={<RotateCw size={15} />}
                        onClick={handleFlip}
                    >
                        Reveal Answer
                    </Button>
                </div>
            )}
        </div>
    );
}
