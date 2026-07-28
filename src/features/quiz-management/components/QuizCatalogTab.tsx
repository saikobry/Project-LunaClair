import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Plus, Pencil, Archive, CheckCircle, Inbox } from 'lucide-react';
import type { Question } from '../../../domain/quiz/Question';
import type { Quiz, QuizStatus } from '../../../domain/quiz/Quiz';
import type { CreateQuizInput, UpdateQuizInput } from '../../../domain/quiz/QuizRepository';
import { Button } from '../../../shared/ui/Button';
import { useToast } from '../../../app/providers/ToastContext';
import { QuizBuilderDialog } from './QuizBuilderDialog';

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
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    card: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: 16,
        backgroundColor: 'var(--color-background-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
    },
    cardContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flex: 1,
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
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
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
});

interface QuizCatalogTabProps {
    quizzes: Quiz[];
    questions: Question[];
    materialId: string;
    onCreate: (input: CreateQuizInput, questions: Question[]) => void;
    onUpdate: (id: string, input: UpdateQuizInput) => void;
    onPublish: (id: string) => void;
    onArchive: (id: string) => void;
}

const statusBadgeStyle = (status: QuizStatus) => {
    switch (status) {
        case 'published': return styles.badgePublished;
        case 'draft': return styles.badgeDraft;
        case 'archived': return styles.badgeArchived;
    }
};

export function QuizCatalogTab({
    quizzes,
    questions,
    materialId,
    onCreate,
    onUpdate,
    onPublish,
    onArchive,
}: QuizCatalogTabProps) {
    const { showToast } = useToast();
    const [builderOpen, setBuilderOpen] = useState(false);
    const [editTargetQuiz, setEditTargetQuiz] = useState<Quiz | null>(null);

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.header)}>
                <span />
                <Button
                    label="Create quiz"
                    variant="primary"
                    icon={<Plus size={14} />}
                    onClick={() => { setEditTargetQuiz(null); setBuilderOpen(true); }}
                >
                    + Create Quiz
                </Button>
            </div>

            {quizzes.length === 0 ? (
                <div {...stylex.props(styles.empty)}>
                    <Inbox size={40} />
                    <p>No quizzes yet. Create one to get started.</p>
                </div>
            ) : (
                <div {...stylex.props(styles.list)}>
                    {quizzes.map((quiz) => (
                        <div key={quiz.id} {...stylex.props(styles.card)}>
                            <div {...stylex.props(styles.cardContent)}>
                                <p {...stylex.props(styles.title)}>{quiz.title}</p>
                                {quiz.description && (
                                    <p {...stylex.props(styles.description)}>{quiz.description}</p>
                                )}
                                <div {...stylex.props(styles.meta)}>
                                    <span>{quiz.questionIds.length} questions</span>
                                    {quiz.passingPercentage != null && (
                                        <span>Pass: {quiz.passingPercentage}%</span>
                                    )}
                                </div>
                                <div {...stylex.props(styles.badges)}>
                                    <span {...stylex.props(styles.badge, statusBadgeStyle(quiz.status))}>
                                        {quiz.status}
                                    </span>
                                </div>
                            </div>
                            <div {...stylex.props(styles.cardActions)}>
                                {quiz.status === 'draft' && (
                                    <Button
                                        label={`Publish quiz: ${quiz.title}`}
                                        variant="secondary"
                                        icon={<CheckCircle size={14} />}
                                        isIconOnly
                                        onClick={() => { onPublish(quiz.id); showToast('Quiz published to catalog', { intent: 'success' }); }}
                                    />
                                )}
                                <Button
                                    label={`Edit quiz: ${quiz.title}`}
                                    variant="secondary"
                                    icon={<Pencil size={14} />}
                                    isIconOnly
                                    onClick={() => { setEditTargetQuiz(quiz); setBuilderOpen(true); }}
                                />
                                {quiz.status !== 'archived' && (
                                    <Button
                                        label={`Archive quiz: ${quiz.title}`}
                                        variant="danger"
                                        icon={<Archive size={14} />}
                                        isIconOnly
                                        onClick={() => { onArchive(quiz.id); showToast('Quiz archived', { intent: 'info' }); }}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <QuizBuilderDialog
                key={editTargetQuiz?.id ?? 'new-quiz'}
                isOpen={builderOpen}
                onClose={() => setBuilderOpen(false)}
                materialId={materialId}
                questions={questions}
                quiz={editTargetQuiz}
                onSave={onCreate}
                onUpdate={onUpdate}
            />
        </div>
    );
}
