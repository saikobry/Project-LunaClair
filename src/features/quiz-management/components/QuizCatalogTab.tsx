import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Plus, Pencil, Archive, ArchiveRestore, CheckCircle, Inbox, EyeOff, Eye } from 'lucide-react';
import type { Quiz, QuizStatus } from '../../../domain/quiz/Quiz';
import type { CSSProperties } from 'react';
import type { AppRoute } from '../../../app/layouts/AppShell';
import { Button } from '../../../shared/ui/Button/Button';
import { Card } from '../../../shared/ui/Card';
import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';

import { useToast } from '../../../app/providers/ToastContext';

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    archivedHint: {
        fontSize: 12,
        color: 'var(--color-text-disabled)',
        margin: 0,
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    cardContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flex: 1,
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    description: {
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
    meta: {
        display: 'flex',
        gap: 12,
        fontSize: 12,
        color: 'var(--color-text-disabled)',
    },
    badges: {
        display: 'flex',
        gap: 6,
    },
    cardActions: {
        display: 'flex',
        gap: 6,
        flexShrink: 0,
    },
    empty: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '48px 24px',
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
    },
    statusBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        border: 'none',
        borderRadius: 5,
    },
    badgePublished: {
        backgroundColor: 'var(--color-success-muted)',
        color: '#166534',
    },
    badgeDraft: {
        backgroundColor: 'var(--color-warning-muted)',
        color: '#854d0e',
    },
    badgeArchived: {
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-disabled)',
    },
});

function statusBadgeStyle(status: QuizStatus) {
    switch (status) {
        case 'published': return styles.badgePublished;
        case 'draft': return styles.badgeDraft;
        case 'archived': return styles.badgeArchived;
    }
}

function statusBorderColor(status: QuizStatus): string {
    switch (status) {
        case 'published':
            return 'var(--color-success-muted)';
        case 'draft':
            return 'var(--color-warning-muted)';
        case 'archived':
            return 'var(--color-background-muted)';
    }
}

const STATUS_RANK: Record<string, number> = { published: 0, draft: 1, archived: 2 };

interface QuizCatalogTabProps {
    quizzes: Quiz[];
    materialId: string;
    onNavigate: (route: AppRoute) => void;
    onPublish: (id: string) => void;
    onArchive: (id: string) => void;
    onUnarchive?: (id: string) => void;
}

export function QuizCatalogTab({
    quizzes,
    materialId,
    onNavigate,
    onPublish,
    onArchive,
    onUnarchive,
}: QuizCatalogTabProps) {
    const { showToast } = useToast();
    const [archiveTargetQuiz, setArchiveTargetQuiz] = useState<Quiz | null>(null);
    const [showArchived, setShowArchived] = useState(false);

    const archivedCount = quizzes.filter((q) => q.status === 'archived').length;
    const visibleQuizzes = showArchived
        ? quizzes
        : quizzes.filter((q) => q.status !== 'archived');

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.header)}>
                <div {...stylex.props(styles.headerLeft)}>
                    {archivedCount > 0 && (
                        <>
                            {showArchived ? (
                                <Button
                                    label="Hide archived quizzes"
                                    variant="secondary"
                                    icon={<EyeOff size={14} />}
                                    isIconOnly
                                    tooltip="Hide archived quizzes"
                                    onClick={() => setShowArchived(false)}
                                />
                            ) : (
                                <Button
                                    label="Show archived quizzes"
                                    variant="secondary"
                                    icon={<Eye size={14} />}
                                    isIconOnly
                                    tooltip={`Show ${archivedCount} archived ${archivedCount === 1 ? 'quiz' : 'quizzes'}`}
                                    onClick={() => setShowArchived(true)}
                                />
                            )}
                            <p {...stylex.props(styles.archivedHint)}>
                                {showArchived ? 'Showing archived' : `${archivedCount} archived`}
                            </p>
                        </>
                    )}
                </div>
                <Button
                    label="Create quiz"
                    variant="primary"
                    icon={<Plus size={14} />}
                    onClick={() => onNavigate({ kind: 'quiz-canvas', materialId })}
                >
                    Create Quiz
                </Button>
            </div>

            {quizzes.length === 0 ? (
                <div {...stylex.props(styles.empty)}>
                    <Inbox size={40} />
                    <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>Start building your quiz catalog</p>
                    <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 12px 0', fontSize: 13 }}>
                        Add questions on the canvas or import them from the question bank.
                    </p>
                    <Button
                        label="Create first quiz"
                        variant="primary"
                        icon={<Plus size={14} />}
                        onClick={() => onNavigate({ kind: 'quiz-canvas', materialId })}
                    >
                        Create First Quiz
                    </Button>
                </div>
            ) : visibleQuizzes.length === 0 ? (
                <div {...stylex.props(styles.empty)}>
                    <ArchiveRestore size={40} />
                    <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>All quizzes are archived</p>
                    <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 12px 0', fontSize: 13 }}>
                        Click the eye icon above to show archived quizzes and restore them.
                    </p>
                </div>
            ) : (
                <div {...stylex.props(styles.list)}>
                    {visibleQuizzes.toSorted((a, b) => (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0) || a.title.localeCompare(b.title)).map((quiz) => (
                        <Card key={quiz.id} style={{ padding: 16, border: `2px solid ${statusBorderColor(quiz.status)}` } as CSSProperties}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                <div {...stylex.props(styles.cardContent)}>
                                    <div {...stylex.props(styles.titleRow)}>
                                        <p {...stylex.props(styles.title)}>{quiz.title}</p>
                                    </div>
                                    {quiz.description && (
                                        <p {...stylex.props(styles.description)}>{quiz.description}</p>
                                    )}
                                    <div {...stylex.props(styles.meta)}>
                                        <span>{quiz.questionIds.length} question{quiz.questionIds.length !== 1 ? 's' : ''}</span>
                                        {quiz.passingPercentage != null && (
                                            <span>Pass: {quiz.passingPercentage}%</span>
                                        )}
                                    </div>
                                    <div {...stylex.props(styles.badges)}>
                                        <span {...stylex.props(styles.statusBadge, statusBadgeStyle(quiz.status))}>{quiz.status}</span>
                                    </div>
                                </div>
                                <div {...stylex.props(styles.cardActions)}>
                                    {quiz.status === 'draft' && (
                                        <Button
                                            label={`Publish quiz: ${quiz.title}`}
                                            variant="secondary"
                                            icon={<CheckCircle size={14} />}
                                            isIconOnly
                                            tooltip="Publish"
                                            onClick={() => { onPublish(quiz.id); showToast('Quiz published to catalog', { intent: 'success' }); }}
                                        />
                                    )}
                                    <Button
                                        label={`Edit quiz: ${quiz.title}`}
                                        variant="secondary"
                                        icon={<Pencil size={14} />}
                                        isIconOnly
                                        tooltip="Edit"
                                        onClick={() => onNavigate({ kind: 'quiz-canvas', materialId, quizId: quiz.id })}
                                    />
                                    {quiz.status === 'archived' && onUnarchive ? (
                                        <Button
                                            label={`Restore quiz: ${quiz.title}`}
                                            variant="secondary"
                                            icon={<ArchiveRestore size={14} />}
                                            isIconOnly
                                            tooltip="Restore"
                                            onClick={() => { onUnarchive(quiz.id); showToast('Quiz restored to draft', { intent: 'success' }); }}
                                        />
                                    ) : (
                                        <Button
                                            label={`Archive quiz: ${quiz.title}`}
                                            variant="danger"
                                            icon={<Archive size={14} />}
                                            isIconOnly
                                            tooltip="Archive"
                                            onClick={() => setArchiveTargetQuiz(quiz)}
                                        />
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <ConfirmationDialog
                isOpen={Boolean(archiveTargetQuiz)}
                title="Archive Quiz"
                message={`Are you sure you want to archive "${archiveTargetQuiz?.title}"? It will no longer be visible in the active catalog, but you can restore it anytime.`}
                confirmLabel="Archive Quiz"
                cancelLabel="Cancel"
                intent="warning"
                onConfirm={() => {
                    if (archiveTargetQuiz) {
                        onArchive(archiveTargetQuiz.id);
                        showToast('Quiz archived', { intent: 'info' });
                    }
                    setArchiveTargetQuiz(null);
                }}
                onCancel={() => setArchiveTargetQuiz(null)}
            />
        </div>
    );
}
