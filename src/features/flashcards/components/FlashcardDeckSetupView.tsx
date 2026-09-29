import * as stylex from '@stylexjs/stylex';
import { Layers, Play, Clock, Sparkles, Filter } from 'lucide-react';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { Question } from '../../../domain/quiz/models/Question';
import type { ReviewState } from '../../../domain/flashcards/engines/scheduler';
import { Button } from '../../../shared/ui/Button/Button';
import type { DeckStudyMode } from '../../../domain/flashcards/engines/deck';
import { collectDeckCardStats, resolveDeckEmptyState } from '../utils/deckCardStats';
import { describeDeckEmptyState } from '../utils/describeDeckEmptyState';
import { useState, type ReactNode } from 'react';

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 720,
        width: '100%',
        margin: '0 auto',
        padding: '24px 16px',
        boxSizing: 'border-box',
    },
    headerCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: 32,
        backgroundColor: 'var(--color-background-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        textAlign: 'center',
    },
    iconBadge: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: 'var(--color-accent-muted)',
        color: 'var(--color-accent)',
    },
    title: {
        fontSize: 22,
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    description: {
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        margin: 0,
        lineHeight: 1.5,
        maxWidth: 520,
    },
    metaGrid: {
        display: 'flex',
        gap: 12,
        marginTop: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    metaBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        padding: '6px 12px',
        borderRadius: 8,
        backgroundColor: 'var(--color-background-muted)',
    },
    dueBadge: {
        backgroundColor: 'var(--color-accent-muted)',
        color: 'var(--color-accent)',
        fontWeight: 600,
    },
    configSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
        marginTop: 12,
    },
    controlGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        textAlign: 'left',
    },
    label: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    modeSelector: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
    },
    modeOption: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: 14,
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-background-surface)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        textAlign: 'left',
        // <button> elements don't inherit font styles by default
        fontFamily: 'inherit',
        fontSize: 'inherit',
    },
    modeOptionActive: {
        borderColor: 'var(--color-accent)',
        backgroundColor: 'var(--color-accent-muted)',
    },
    modeTitle: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
    },
    modeDesc: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
    },
    select: {
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-background-surface)',
        color: 'var(--color-text-primary)',
        fontSize: 14,
        outline: 'none',
    },
    emptyState: {
        padding: 24,
        color: 'var(--color-text-secondary)',
        fontSize: 14,
    },
    // A status note, not an alert: an empty deck is an expected outcome of
    // spaced repetition, so it carries no error token and no failure styling.
    blockedReason: {
        margin: '12px auto 0',
        maxWidth: 520,
        fontSize: 13,
        lineHeight: 1.5,
        textAlign: 'center',
        color: 'var(--color-text-secondary)',
    },
});

/** Id the disabled Start button points at, so its reason travels with it. */
const BLOCKED_REASON_ID = 'flashcard-deck-blocked-reason';

interface FlashcardDeckSetupViewProps {
    questions: Question[];
    quizzes: Quiz[];
    reviews: Record<string, ReviewState>;
    onStartSession: (selectedQuizId?: string, studyMode?: DeckStudyMode) => void;
    /**
     * Opens the Question Bank for this material — the app's only authoring surface.
     * This feature creates nothing: a card is a projection of a typed question, so
     * "add cards" is "add questions". Wired by the workspace as a `?tab=questions`
     * navigation plus a one-shot launch intent; there is no dialog to open from here.
     */
    onOpenQuestionBank: () => void;
}

function StatBadge({ icon, emphasized, children }: { icon: ReactNode; emphasized?: boolean; children: ReactNode }) {
    return (
        <div {...stylex.props(styles.metaBadge, emphasized && styles.dueBadge)}>
            {icon}
            <span>{children}</span>
        </div>
    );
}

function DeckStatsRow({ dueCount, newCount, total }: { dueCount: number; newCount: number; total: number }) {
    return (
        <div {...stylex.props(styles.metaGrid)}>
            <StatBadge icon={<Clock size={15} />} emphasized={dueCount > 0}>
                {dueCount} {dueCount === 1 ? 'Card' : 'Cards'} Due Today
            </StatBadge>
            <StatBadge icon={<Sparkles size={15} />}>
                {newCount} New
            </StatBadge>
            <StatBadge icon={<Layers size={15} />}>
                {total} Total in Bank
            </StatBadge>
        </div>
    );
}

function StudyModeSelector({
    studyMode,
    dueCount,
    totalCards,
    onModeChange,
}: {
    studyMode: DeckStudyMode;
    dueCount: number;
    totalCards: number;
    onModeChange: (mode: DeckStudyMode) => void;
}) {
    return (
        <div {...stylex.props(styles.modeSelector)}>
            <button
                type="button"
                {...stylex.props(
                    styles.modeOption,
                    studyMode === 'due_only' && styles.modeOptionActive
                )}
                onClick={() => onModeChange('due_only')}
                aria-pressed={studyMode === 'due_only'}
            >
                <span {...stylex.props(styles.modeTitle)}>Due Cards Only</span>
                <span {...stylex.props(styles.modeDesc)}>
                    Focus on {dueCount} cards due for scheduled review today
                </span>
            </button>

            <button
                type="button"
                {...stylex.props(
                    styles.modeOption,
                    studyMode === 'all' && styles.modeOptionActive
                )}
                onClick={() => onModeChange('all')}
                aria-pressed={studyMode === 'all'}
            >
                <span {...stylex.props(styles.modeTitle)}>All Cards</span>
                <span {...stylex.props(styles.modeDesc)}>
                    Review entire deck ({totalCards} cards; due cards first)
                </span>
            </button>
        </div>
    );
}

function QuizFilterControl({
    activeQuizzes,
    totalCards,
    cardsByQuizId,
    selectedQuizId,
    onSelectedChange,
}: {
    activeQuizzes: Quiz[];
    totalCards: number;
    cardsByQuizId: Map<string, number>;
    selectedQuizId: string;
    onSelectedChange: (value: string) => void;
}) {
    return (
        <div {...stylex.props(styles.controlGroup)}>
            <label htmlFor="flashcard-quiz-filter" {...stylex.props(styles.label)}>
                <Filter size={14} /> Quiz Filter
            </label>
            <select
                id="flashcard-quiz-filter"
                aria-label="Quiz Filter"
                {...stylex.props(styles.select)}
                value={selectedQuizId}
                onChange={(e) => onSelectedChange(e.target.value)}
            >
                <option value="all">All Quizzes ({totalCards} cards)</option>
                {activeQuizzes.map((quiz) => (
                    <option key={quiz.id} value={quiz.id}>
                        {quiz.title} ({cardsByQuizId.get(quiz.id) ?? 0} cards)
                    </option>
                ))}
            </select>
        </div>
    );
}

export function FlashcardDeckSetupView({
    questions,
    quizzes,
    reviews,
    onStartSession,
    onOpenQuestionBank,
}: FlashcardDeckSetupViewProps) {
    const now = new Date();

    const activeQuestions = questions.filter((q) => q.status !== 'archived');
    const activeQuizzes = quizzes.filter((q) => q.status !== 'archived');

    // Every count below is a card count, never a question count — see
    // `collectDeckCardStats`.
    const stats = collectDeckCardStats(activeQuestions, activeQuizzes, reviews, now);
    const { totalCards, dueCount, newCount, cardsByQuizId } = stats;

    const [studyMode, setStudyMode] = useState<DeckStudyMode>(dueCount > 0 ? 'due_only' : 'all');
    const [selectedQuizId, setSelectedQuizId] = useState<string>('all');

    // Resolved from the active quizzes, so a filter value that no longer names
    // one falls back to the whole material — the same fallback the start handler
    // applies, rather than a second, stricter rule.
    const selectedQuiz = activeQuizzes.find((q) => q.id === selectedQuizId) ?? null;

    // Re-derived on every render, so switching the quiz filter or the study mode
    // re-derives the reason and the disabled state together.
    const blockedReason = resolveDeckEmptyState(stats, { quiz: selectedQuiz }, studyMode, now).reason;
    const blockedMessage = blockedReason ? describeDeckEmptyState(blockedReason, { now }) : null;

    const handleStart = () => {
        onStartSession(
            selectedQuizId === 'all' ? undefined : selectedQuizId,
            studyMode
        );
    };

    if (totalCards === 0) {
        return (
            <div {...stylex.props(styles.container)}>
                <div {...stylex.props(styles.headerCard)}>
                    <div {...stylex.props(styles.iconBadge)}>
                        <Layers size={26} />
                    </div>
                    <h2 {...stylex.props(styles.title)}>No Flashcards Available</h2>
                    <p {...stylex.props(styles.description)}>
                        This material doesn&apos;t have any questions yet, so there is nothing to study
                        from. Cards are built from your Question Bank — add questions there and they
                        appear here automatically.
                    </p>
                    <div style={{ marginTop: 8, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {/* With nothing to study, authoring IS the action — so it is the primary
                            control here, not the quiet "Add questions" of the populated view.
                            The workspace routes this through the shell's launch intent, so the
                            Bank opens on Fill in the Blank and offers a way back to this tab. */}
                        <Button
                            label="Generate questions"
                            variant="primary"
                            icon={<Sparkles size={16} />}
                            onClick={onOpenQuestionBank}
                        >
                            Generate questions
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.headerCard)}>
                <div {...stylex.props(styles.iconBadge)}>
                    <Layers size={26} />
                </div>
                <h2 {...stylex.props(styles.title)}>Flashcards & Spaced Repetition</h2>
                <p {...stylex.props(styles.description)}>
                    Review key concepts with SM-2 spaced repetition. Cards are generated automatically from your question bank.
                </p>

                <DeckStatsRow dueCount={dueCount} newCount={newCount} total={totalCards} />

                <div {...stylex.props(styles.configSection)}>
                    <div {...stylex.props(styles.controlGroup)}>
                        <label {...stylex.props(styles.label)}>
                            <Clock size={14} /> Study Mode
                        </label>
                        <StudyModeSelector
                            studyMode={studyMode}
                            dueCount={dueCount}
                            totalCards={totalCards}
                            onModeChange={setStudyMode}
                        />
                    </div>

                    {activeQuizzes.length > 1 && (
                        <QuizFilterControl
                            activeQuizzes={activeQuizzes}
                            totalCards={totalCards}
                            cardsByQuizId={cardsByQuizId}
                            selectedQuizId={selectedQuizId}
                            onSelectedChange={setSelectedQuizId}
                        />
                    )}
                </div>

                <div style={{ marginTop: 20, width: '100%', display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button
                        label="Start Flashcard Session"
                        variant="primary"
                        icon={<Play size={16} />}
                        onClick={handleStart}
                        isDisabled={blockedMessage !== null}
                        aria-describedby={blockedMessage ? BLOCKED_REASON_ID : undefined}
                    >
                        Start Flashcard Session
                    </Button>
                    {/* A populated deck is a STUDY surface, so authoring is deliberately quiet:
                        ghost variant, no accent fill, sitting beside the primary Start action
                        rather than competing with it. It routes to the Question Bank — this
                        feature creates nothing. */}
                    <Button
                        label="Add questions"
                        variant="ghost"
                        onClick={onOpenQuestionBank}
                    >
                        Add questions
                    </Button>
                </div>

                {blockedMessage && (
                    <p id={BLOCKED_REASON_ID} {...stylex.props(styles.blockedReason)}>
                        {blockedMessage}
                    </p>
                )}
            </div>
        </div>
    );
}
