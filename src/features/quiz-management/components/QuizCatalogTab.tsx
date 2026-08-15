import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Plus, Pencil, Archive, ArchiveRestore, CheckCircle, Inbox, EyeOff, Eye } from 'lucide-react';
import type { Quiz, QuizStatus } from '../../../domain/quiz/Quiz';
import type { AppRoute } from '../../../app/layouts/AppShell';
import { Button } from '../../../shared/ui/Button/Button';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
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
    catalogCard: {
        backgroundColor: 'var(--color-background-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 16,
        boxShadow: 'var(--shadow-low)',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
        ':hover': {
            borderColor: 'var(--color-accent)',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.12)',
            transform: 'translateY(-1px)',
        },
    },
    cardStatusPublished: {
        borderLeft: '3px solid var(--color-success)',
    },
    cardStatusDraft: {
        borderLeft: '3px solid var(--color-warning)',
    },
    cardStatusArchived: {
        borderLeft: '3px solid var(--color-border-emphasized)',
    },
    cardContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flex: 1,
    },
    titleRow: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
        flex: 1,
        minWidth: 0,
    },
    topRightStatusBadge: {
        flexShrink: 0,
    },
    description: {
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
    meta: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    metaChip: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 5,
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-secondary)',
    },
    passTag: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 5,
        backgroundColor: 'var(--color-accent-muted)',
        color: 'var(--color-accent)',
    },
    cardFooter: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingTop: 10,
        marginTop: 6,
        borderTop: '1px solid var(--color-border)',
    },
    cardActions: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
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
        textTransform: 'capitalize',
        letterSpacing: 0.4,
        border: 'none',
        borderRadius: 5,
    },
    badgePublished: {
        backgroundColor: 'var(--color-success-muted)',
        color: 'var(--color-on-success-muted)',
    },
    badgeDraft: {
        backgroundColor: 'var(--color-warning-muted)',
        color: 'var(--color-on-warning-muted)',
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

function statusAccentStyle(status: QuizStatus) {
    switch (status) {
        case 'published': return styles.cardStatusPublished;
        case 'draft': return styles.cardStatusDraft;
        case 'archived': return styles.cardStatusArchived;
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
                <EmptyState
                    icon={<Inbox size={28} />}
                    title="Start building your quiz catalog"
                    description="Add questions on the canvas or import them from the question bank."
                    headingLevel="h3"
                    action={
                        <Button
                            label="Create first quiz"
                            variant="primary"
                            icon={<Plus size={14} />}
                            onClick={() => onNavigate({ kind: 'quiz-canvas', materialId })}
                        >
                            Create First Quiz
                        </Button>
                    }
                />
            ) : visibleQuizzes.length === 0 ? (
                <EmptyState
                    icon={<ArchiveRestore size={28} />}
                    iconVariant="muted"
                    title="All quizzes are archived"
                    description="Click the eye icon above to show archived quizzes and restore them."
                    headingLevel="h3"
                />
            ) : (
                <div {...stylex.props(styles.list)}>
                    {visibleQuizzes.toSorted((a, b) => (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0) || a.title.localeCompare(b.title)).map((quiz) => (
                        <div
                            key={quiz.id}
                            {...stylex.props(styles.catalogCard, statusAccentStyle(quiz.status))}
                        >
                            <div {...stylex.props(styles.cardContent)}>
                                <div {...stylex.props(styles.titleRow)}>
                                    <p {...stylex.props(styles.title)}>{quiz.title}</p>
                                    <span {...stylex.props(
                                        styles.statusBadge,
                                        styles.topRightStatusBadge,
                                        statusBadgeStyle(quiz.status),
                                    )}>{quiz.status}</span>
                                </div>
                                {quiz.description && (
                                    <p {...stylex.props(styles.description)}>{quiz.description}</p>
                                )}
                                <div {...stylex.props(styles.meta)}>
                                    <span {...stylex.props(styles.metaChip)}>
                                        {quiz.questionIds.length} question{quiz.questionIds.length !== 1 ? 's' : ''}
                                    </span>
                                    {quiz.passingPercentage != null && (
                                        <span {...stylex.props(styles.passTag)}>Pass: {quiz.passingPercentage}%</span>
                                    )}
                                </div>

                                <div {...stylex.props(styles.cardFooter)}>
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
                            </div>
                        </div>
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
