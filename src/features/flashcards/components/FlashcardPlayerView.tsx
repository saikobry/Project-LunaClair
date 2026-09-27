import * as stylex from '@stylexjs/stylex';
import { useState, useEffect, useCallback, useEffectEvent } from 'react';
import { RotateCw, X, Check, HelpCircle, AlertCircle, Award } from 'lucide-react';
import type { Flashcard, FlashcardChoice } from '../../../domain/flashcards/models/Flashcard';
import type { Rating } from '../../../domain/flashcards/engines/scheduler';
import { Button } from '../../../shared/ui/Button/Button';

/** Shape label — never the source question type, which the projection drops. */
const CHOICE_KIND_LABEL = 'MULTIPLE ANSWER';

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
        // The faces are absolutely positioned to fill the wrapper, so the wrapper
        // is what bounds the per-face scroll region. `minHeight` alone would give
        // the scroll area nothing to shrink against, hence the viewport-aware
        // height plus the clamped upper bound.
        minHeight: 340,
        height: 'clamp(340px, 68vh, 520px)',
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
    // Only the face the card is currently showing may take pointer input. The
    // faces are stacked (`inset: 0`) and a backface-hidden face is still hit
    // tested in some engines, so each face's interactive region would otherwise
    // be covered by the other face's region.
    cardFaceActive: {
        pointerEvents: 'auto',
    },
    cardFaceInert: {
        pointerEvents: 'none',
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
    choiceList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        maxWidth: 520,
        margin: '0 auto',
    },
    choiceRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-primary)',
        fontSize: 15,
        lineHeight: 1.4,
        textAlign: 'left',
    },
    choiceRowCorrect: {
        borderColor: 'color-mix(in srgb, var(--color-success) 40%, transparent)',
        backgroundColor: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
        color: 'var(--color-success)',
        fontWeight: 600,
    },
    choiceMarker: {
        flexShrink: 0,
    },
    difficultyEasy: {
        backgroundColor: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
        color: 'var(--color-success)',
    },
    difficultyMedium: {
        backgroundColor: 'var(--color-warning-muted)',
        color: 'var(--color-warning)',
    },
    difficultyHard: {
        backgroundColor: 'var(--color-error-muted)',
        color: 'var(--color-error)',
    },
    // Bounded, keyboard-reachable scroll region shared by both faces. `minHeight:
    // 0` lets the flex item shrink below its content so the overflow is real; the
    // centered `contentBox` uses `margin: auto` rather than `justify-content:
    // center`, because centered content in a scroll container clips the start of
    // the overflow (the top of a tall card) with no way to scroll back to it.
    scrollArea: {
        flex: 1,
        minHeight: 0,
        width: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        // Side padding is on contentBox; this region only supplies the bottom
        // breathing room, and it must hold the flip hint so the hint's own
        // "Click to reveal" instruction is actually inside the click surface.
        padding: '0 0 12px 0',
        boxSizing: 'border-box',
        borderRadius: 10,
        cursor: 'pointer',
        ':focus-visible': {
            outline: '2px solid var(--color-accent)',
            outlineOffset: '2px',
        },
    },
    contentBox: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        width: '100%',
        padding: '20px 0',
        gap: 12,
        margin: 'auto',
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
        borderColor: 'color-mix(in srgb, var(--color-error) 30%, transparent)',
        color: 'var(--color-error)',
        ':hover': {
            backgroundColor: 'var(--color-error-muted)',
        },
    },
    ratingBtnHard: {
        borderColor: 'color-mix(in srgb, var(--color-warning) 30%, transparent)',
        color: 'var(--color-warning)',
        ':hover': {
            backgroundColor: 'var(--color-warning-muted)',
        },
    },
    ratingBtnGood: {
        borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
        color: 'var(--color-accent)',
        ':hover': {
            backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
        },
    },
    ratingBtnEasy: {
        borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)',
        color: 'var(--color-success)',
        ':hover': {
            backgroundColor: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
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
    const card = deck[currentIndex];
    if (!card) return null;

    const total = deck.length;
    const progressPct = ((currentIndex + 1) / total) * 100;

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

            {/* 3D Flip Card — keyed by card identity so the flip state resets
                naturally when the card changes: React remounts the subtree, no
                reset-on-prop-change effect and no stale-state flash. */}
            <FlashcardCard key={card.key} card={card} onRating={onRating} />
        </div>
    );
}

/**
 * One flip card (front/back faces + rating controls). Owns its own flip
 * state; the parent keys it by card identity so advancing to the next card
 * remounts it fresh.
 */
function FlashcardCard({
    card,
    onRating,
}: {
    card: Flashcard;
    onRating: (card: Flashcard, rating: Rating) => void;
}) {
    const [isFlipped, setIsFlipped] = useState(false);

    const handleFlip = useCallback(() => {
        setIsFlipped((prev) => !prev);
    }, []);

    // Keyboard activation for the card (each face's scroll region is the
    // `role="button"` flip control). The window handler below also listens for
    // Space/Enter, so stop propagation here to avoid a double flip when the
    // control has focus.
    const handleCardKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleFlip();
            }
        },
        [handleFlip]
    );

    // Keyboard navigation — an Effect Event keeps the window listener
    // subscribed once while still reading the freshest state/callbacks
    // (flip state, rating handler) on every keypress.
    const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            if (!isFlipped) {
                handleFlip();
            }
        } else if (isFlipped) {
            if (e.key === '1') onRating(card, 'again');
            if (e.key === '2') onRating(card, 'hard');
            if (e.key === '3') onRating(card, 'good');
            if (e.key === '4') onRating(card, 'easy');
        }
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => onKeyDown(e);
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const difficultyStyle =
        card.difficulty === 'easy'
            ? styles.difficultyEasy
            : card.difficulty === 'hard'
            ? styles.difficultyHard
            : styles.difficultyMedium;

    return (
        <>
            <div {...stylex.props(styles.cardWrapper)}>
                <div
                    {...stylex.props(
                        styles.cardInner,
                        isFlipped && styles.cardFlipped
                    )}
                >
                    {/* Front Face — its scroll region IS the front-facing flip
                        control: it carries the flip action's accessible name and
                        has no focusable descendant, so the interactive ancestor
                        never nests another focusable control. */}
                    <div
                        {...stylex.props(
                            styles.cardFace,
                            isFlipped ? styles.cardFaceInert : styles.cardFaceActive
                        )}
                    >
                        <div {...stylex.props(styles.metaRow)}>
                            <span {...stylex.props(styles.badge, difficultyStyle)}>
                                Source difficulty: {card.difficulty}
                            </span>
                            {card.kind === 'choice' && (
                                <span {...stylex.props(styles.badge, styles.typeBadge)}>
                                    {CHOICE_KIND_LABEL}
                                </span>
                            )}
                            {card.tags?.map((t) => (
                                <span key={t} {...stylex.props(styles.badge)}>
                                    #{t}
                                </span>
                            ))}
                        </div>

                        <div
                            {...stylex.props(styles.scrollArea)}
                            role="button"
                            aria-label="Show answer"
                            tabIndex={isFlipped ? -1 : 0}
                            onClick={handleFlip}
                            onKeyDown={handleCardKeyDown}
                        >
                            <div {...stylex.props(styles.contentBox)}>
                                <p {...stylex.props(styles.promptText)}>{card.front}</p>
                                {/* Options are part of the question, so they belong on
                                    the front face — ungraded, since correctness is
                                    only revealed on the back. */}
                                {card.kind === 'choice' && (
                                    <CardChoices choices={card.choices} revealCorrect={false} />
                                )}
                            </div>

                            <div {...stylex.props(styles.flipHint)}>
                                <RotateCw size={14} />
                                <span>Click or press Space to reveal answer</span>
                            </div>
                        </div>
                    </div>

                    {/* Back Face — same contract as the front: the answer's
                        scroll region is the flipped card's flip control. */}
                    <div
                        {...stylex.props(
                            styles.cardFace,
                            styles.cardFaceBack,
                            isFlipped ? styles.cardFaceActive : styles.cardFaceInert
                        )}
                    >
                        <div {...stylex.props(styles.metaRow)}>
                            <span {...stylex.props(styles.badge)}>Answer</span>
                        </div>

                        <div
                            {...stylex.props(styles.scrollArea)}
                            role="button"
                            aria-label="Show question"
                            tabIndex={isFlipped ? 0 : -1}
                            onClick={handleFlip}
                            onKeyDown={handleCardKeyDown}
                        >
                            <div {...stylex.props(styles.contentBox)}>
                                {card.kind === 'choice' ? (
                                    <CardChoices choices={card.choices} revealCorrect />
                                ) : (
                                    <p {...stylex.props(styles.answerText)}>{card.back}</p>
                                )}
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
            </div>

            {/* Rating Bar (active when flipped) */}
            {isFlipped ? (
                <div {...stylex.props(styles.ratingBar)}>
                    <button
                        {...stylex.props(styles.ratingButton, styles.ratingBtnAgain)}
                        onClick={() => onRating(card, 'again')}
                    >
                        <AlertCircle size={18} />
                        <span {...stylex.props(styles.ratingLabel)}>Again</span>
                        <span {...stylex.props(styles.ratingKey)}>Key 1</span>
                    </button>

                    <button
                        {...stylex.props(styles.ratingButton, styles.ratingBtnHard)}
                        onClick={() => onRating(card, 'hard')}
                    >
                        <RotateCw size={18} />
                        <span {...stylex.props(styles.ratingLabel)}>Hard</span>
                        <span {...stylex.props(styles.ratingKey)}>Key 2</span>
                    </button>

                    <button
                        {...stylex.props(styles.ratingButton, styles.ratingBtnGood)}
                        onClick={() => onRating(card, 'good')}
                    >
                        <Check size={18} />
                        <span {...stylex.props(styles.ratingLabel)}>Good</span>
                        <span {...stylex.props(styles.ratingKey)}>Key 3</span>
                    </button>

                    <button
                        {...stylex.props(styles.ratingButton, styles.ratingBtnEasy)}
                        onClick={() => onRating(card, 'easy')}
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
        </>
    );
}

/**
 * A choice card's options. The same list serves both faces so the user reads
 * the same options before and after the flip; `revealCorrect` gates the
 * grading marks so nothing on the front face can hint at the answer.
 */
function CardChoices({
    choices,
    revealCorrect,
}: {
    choices: FlashcardChoice[];
    revealCorrect: boolean;
}) {
    return (
        <div {...stylex.props(styles.choiceList)}>
            {choices.map((choice) => {
                const showMark = revealCorrect && choice.correct;

                return (
                    <span
                        key={choice.label}
                        {...stylex.props(
                            styles.choiceRow,
                            showMark && styles.choiceRowCorrect
                        )}
                        aria-label={
                            showMark ? `${choice.label} — correct answer` : undefined
                        }
                    >
                        {showMark && (
                            <Check size={16} {...stylex.props(styles.choiceMarker)} />
                        )}
                        <span>{choice.label}</span>
                    </span>
                );
            })}
        </div>
    );
}
