import * as stylex from '@stylexjs/stylex';
import { Layers, Play, Clock, Sparkles, Filter, Package, Share2 } from 'lucide-react';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { Question } from '../../../domain/quiz/models/Question';
import type { ReviewState } from '../../../domain/flashcards/engines/scheduler';
import { Button } from '../../../shared/ui/Button/Button';
import type { DeckStudyMode } from '../../../domain/flashcards/engines/deck';
import { collectDeckCardStats } from '../utils/deckCardStats';
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
});

interface FlashcardDeckSetupViewProps {
    questions: Question[];
    quizzes: Quiz[];
    reviews: Record<string, ReviewState>;
    onStartSession: (selectedQuizId?: string, studyMode?: DeckStudyMode) => void;
    onGenerateAi?: () => void;
    onExport?: () => void;
    isExporting?: boolean;
    onShare?: () => void;
}

interface ActionHandlers {
    onGenerateAi?: () => void;
    onExport?: () => void;
    isExporting?: boolean;
    onShare?: () => void;
}

function ActionButtonGroup({ onGenerateAi, onExport, isExporting, onShare }: ActionHandlers) {
    return (
        <>
            {onGenerateAi && (
                <Button
                    label="Generate Flashcards with AI"
                    variant="primary"
                    icon={<Sparkles size={16} />}
                    onClick={onGenerateAi}
                >
                    Generate Flashcards with AI
                </Button>
            )}
            {onShare && (
                <Button
                    label="Share"
                    variant="secondary"
                    icon={<Share2 size={16} />}
                    onClick={onShare}
                >
                    Share
                </Button>
            )}
            {onExport && (
                <Button
                    label="Export as .lcpack"
                    variant="secondary"
                    icon={<Package size={16} />}
                    onClick={onExport}
                    isLoading={isExporting}
                    isDisabled={isExporting}
                >
                    Export as .lcpack
                </Button>
            )}
        </>
    );
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
    onGenerateAi,
    onExport,
    isExporting,
    onShare,
}: FlashcardDeckSetupViewProps) {
    const now = new Date();

    const activeQuestions = questions.filter((q) => q.status !== 'archived');
    const activeQuizzes = quizzes.filter((q) => q.status !== 'archived');

    // Every count below is a card count, never a question count — see
    // `collectDeckCardStats`.
    const { totalCards, dueCount, newCount, cardsByQuizId } = collectDeckCardStats(
        activeQuestions,
        activeQuizzes,
        reviews,
        now
    );

    const [studyMode, setStudyMode] = useState<DeckStudyMode>(dueCount > 0 ? 'due_only' : 'all');
    const [selectedQuizId, setSelectedQuizId] = useState<string>('all');

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
                        This material doesn&apos;t have any flashcards yet. Generate cards directly from your notes using AI, or create questions in the Question Bank!
                    </p>
                    <div style={{ marginTop: 8, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <ActionButtonGroup
                            onGenerateAi={onGenerateAi}
                            onShare={onShare}
                            onExport={onExport}
                            isExporting={isExporting}
                        />
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
                    >
                        Start Flashcard Session
                    </Button>
                    {onGenerateAi && (
                        <Button
                            label="Generate with AI"
                            variant="secondary"
                            icon={<Sparkles size={16} />}
                            onClick={onGenerateAi}
                        >
                            Generate with AI
                        </Button>
                    )}
                    {onShare && (
                        <Button
                            label="Share"
                            variant="secondary"
                            icon={<Share2 size={16} />}
                            onClick={onShare}
                        >
                            Share
                        </Button>
                    )}
                    {onExport && (
                        <Button
                            label="Export as .lcpack"
                            variant="secondary"
                            icon={<Package size={16} />}
                            onClick={onExport}
                            isLoading={isExporting}
                            isDisabled={isExporting}
                        >
                            Export as .lcpack
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
