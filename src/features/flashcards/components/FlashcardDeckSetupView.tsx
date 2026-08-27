import * as stylex from '@stylexjs/stylex';
import { Layers, Play, Clock, Sparkles, Filter, Package, Share2 } from 'lucide-react';
import type { Quiz } from '../../../domain/quiz/Quiz';
import type { Question } from '../../../domain/quiz/Question';
import type { ReviewState } from '../../../domain/flashcards/scheduler';
import { isDue } from '../../../domain/flashcards/scheduler';
import { Button } from '../../../shared/ui/Button/Button';
import type { DeckStudyMode } from '../../../domain/flashcards/deck';
import { useState } from 'react';

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
    const totalQuestions = activeQuestions.length;

    let dueCount = 0;
    let newCount = 0;

    for (const q of activeQuestions) {
        const key = `q:${q.id}`;
        const rev = reviews[key];
        if (!rev || rev.reviewCount === 0) {
            newCount++;
            dueCount++; // New cards are due immediately
        } else if (isDue(rev, now)) {
            dueCount++;
        }
    }

    const [studyMode, setStudyMode] = useState<DeckStudyMode>(dueCount > 0 ? 'due_only' : 'all');
    const [selectedQuizId, setSelectedQuizId] = useState<string>('all');

    const activeQuizzes = quizzes.filter((q) => q.status !== 'archived');

    const handleStart = () => {
        onStartSession(
            selectedQuizId === 'all' ? undefined : selectedQuizId,
            studyMode
        );
    };

    if (totalQuestions === 0) {
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

                <div {...stylex.props(styles.metaGrid)}>
                    <div {...stylex.props(styles.metaBadge, dueCount > 0 && styles.dueBadge)}>
                        <Clock size={15} />
                        <span>{dueCount} {dueCount === 1 ? 'Card' : 'Cards'} Due Today</span>
                    </div>
                    <div {...stylex.props(styles.metaBadge)}>
                        <Sparkles size={15} />
                        <span>{newCount} New</span>
                    </div>
                    <div {...stylex.props(styles.metaBadge)}>
                        <Layers size={15} />
                        <span>{totalQuestions} Total in Bank</span>
                    </div>
                </div>

                <div {...stylex.props(styles.configSection)}>
                    <div {...stylex.props(styles.controlGroup)}>
                        <label {...stylex.props(styles.label)}>
                            <Clock size={14} /> Study Mode
                        </label>
                        <div {...stylex.props(styles.modeSelector)}>
                            <button
                                type="button"
                                {...stylex.props(
                                    styles.modeOption,
                                    studyMode === 'due_only' && styles.modeOptionActive
                                )}
                                onClick={() => setStudyMode('due_only')}
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
                                onClick={() => setStudyMode('all')}
                                aria-pressed={studyMode === 'all'}
                            >
                                <span {...stylex.props(styles.modeTitle)}>All Cards</span>
                                <span {...stylex.props(styles.modeDesc)}>
                                    Review entire deck ({totalQuestions} cards; due cards first)
                                </span>
                            </button>
                        </div>
                    </div>

                    {activeQuizzes.length > 1 && (
                        <div {...stylex.props(styles.controlGroup)}>
                            <label {...stylex.props(styles.label)}>
                                <Filter size={14} /> Quiz Filter
                            </label>
                            <select
                                {...stylex.props(styles.select)}
                                value={selectedQuizId}
                                onChange={(e) => setSelectedQuizId(e.target.value)}
                            >
                                <option value="all">All Quizzes ({totalQuestions} questions)</option>
                                {activeQuizzes.map((quiz) => (
                                    <option key={quiz.id} value={quiz.id}>
                                        {quiz.title} ({quiz.questionIds.length} questions)
                                    </option>
                                ))}
                            </select>
                        </div>
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
