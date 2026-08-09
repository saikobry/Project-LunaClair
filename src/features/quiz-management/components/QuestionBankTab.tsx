import { useState, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Pencil, Archive, ArchiveRestore, CheckCircle, Inbox, Plus, Search } from 'lucide-react';
import type { Question, QuestionStatus, QuestionDifficulty } from '../../../domain/quiz/Question';
import type { QuestionType } from '../../../domain/quiz/QuestionType';
import type { CreateQuestionInput, UpdateQuestionInput } from '../../../domain/quiz/QuestionRepository';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { Card } from '../../../shared/ui/Card';
import { Selector, type SelectorOption } from '../../../shared/ui/Selector/Selector';
import { useToast } from '../../../app/providers/ToastContext';
import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';
import { QuestionEditorDialog } from './QuestionEditorDialog';
import { QuestionPayloadPreview } from './QuestionPayloadPreview';
import { useDebounce } from '../../../shared/hooks';

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    filterBar: {
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'flex-end',
    },
    searchField: {
        flex: 1,
        minWidth: 180,
    },
    newQuestionButton: {
        marginLeft: 'auto',
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
    },
    promptRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
    },
    prompt: {
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        margin: 0,
        lineHeight: 1.5,
        flex: 1,
    },
    badgesRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
    },
    detailSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        paddingTop: 8,
        borderTop: '1px solid var(--color-border)',
    },
    detailLabel: {
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: 'var(--color-text-disabled)',
    },
    explanationPreview: {
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        lineHeight: 1.5,
        margin: 0,
        maxWidth: '80%',
    },
    tagsRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
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
    // Badge variant styles for status and usage
    badgedot: {
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
    badgeUsed: {
        backgroundColor: 'var(--color-accent-muted)',
        color: 'var(--color-accent)',
    },
    badgeUnused: {
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-disabled)',
    },
    badgeHard: {
        backgroundColor: 'var(--color-error-muted)',
        color: 'var(--color-error)',
    },
    badgeEasy: {
        backgroundColor: '#dcfce7',
        color: '#166534',
    },
    badgeMedium: {
        backgroundColor: '#fef3c7',
        color: '#92400e',
    },
    badgePoints: {
        backgroundColor: '#e0e7ff',
        color: '#4338ca',
    },
    // Type badge colors
    badgeMC: {
        backgroundColor: '#dbeafe',
        color: '#1d4ed8',
    },
    badgeMS: {
        backgroundColor: '#ede9fe',
        color: '#6d28d9',
    },
    badgeTF: {
        backgroundColor: '#ccfbf1',
        color: '#0f766e',
    },
    badgeID: {
        backgroundColor: '#fef3c7',
        color: '#b45309',
    },
    badgeFB: {
        backgroundColor: '#fce7f3',
        color: '#be185d',
    },
    tag: {
        fontSize: 10.5,
        padding: '1px 7px',
        border: 'none',
        borderRadius: 4,
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-secondary)',
    },
});

const TYPE_LABELS: Record<QuestionType, string> = {
    multiple_choice: 'Multiple Choice',
    multiple_select: 'Multiple Select',
    true_false: 'True / False',
    identification: 'Identification',
    fill_in_blank: 'Fill in the Blank',
};

const TYPE_OPTIONS: SelectorOption[] = [
    { value: '', label: 'All types' },
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'multiple_select', label: 'Multiple Select' },
    { value: 'true_false', label: 'True / False' },
    { value: 'identification', label: 'Identification' },
    { value: 'fill_in_blank', label: 'Fill in the Blank' },
];

const DIFFICULTY_OPTIONS: SelectorOption[] = [
    { value: '', label: 'All difficulty' },
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
];

const STATUS_OPTIONS: SelectorOption[] = [
    { value: '', label: 'All status' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' },
];

const STATUS_RANK: Record<string, number> = { published: 0, draft: 1, archived: 2 };

interface QuestionBankTabProps {
    questions: Question[];
    quizzes?: import('../../../domain/quiz/Quiz').Quiz[];
    materialId: string;
    onCreate: (input: CreateQuestionInput) => void;
    onUpdate: (id: string, input: UpdateQuestionInput) => void;
    onPublish: (id: string) => void;
    onArchive: (id: string) => void;
    onUnarchive?: (id: string) => void;
}

function statusBorderColor(status: QuestionStatus): string {
    switch (status) {
        case 'published':
            return 'var(--color-success-muted)';
        case 'draft':
            return 'var(--color-warning-muted)';
        case 'archived':
            return 'var(--color-background-muted)';
    }
}

function typeBadgeStyle(type: QuestionType) {
    switch (type) {
        case 'multiple_choice': return styles.badgeMC;
        case 'multiple_select': return styles.badgeMS;
        case 'true_false': return styles.badgeTF;
        case 'identification': return styles.badgeID;
        case 'fill_in_blank': return styles.badgeFB;
    }
}

function difficultyBadgeStyle(difficulty: QuestionDifficulty) {
    switch (difficulty) {
        case 'easy': return styles.badgeEasy;
        case 'medium': return styles.badgeMedium;
        case 'hard': return styles.badgeHard;
    }
}



export function QuestionBankTab({
    questions,
    quizzes = [],
    materialId,
    onCreate,
    onUpdate,
    onPublish,
    onArchive,
    onUnarchive,
}: QuestionBankTabProps) {
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [typeFilter, setTypeFilter] = useState<QuestionType | ''>('');
    const [difficultyFilter, setDifficultyFilter] = useState<QuestionDifficulty | ''>('');
    const [statusFilter, setStatusFilter] = useState<QuestionStatus | ''>('');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Question | null>(null);
    const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        return questions
            .filter((q) => {
                if (debouncedSearch && !q.prompt.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
                if (typeFilter && q.type !== typeFilter) return false;
                if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
                if (statusFilter && q.status !== statusFilter) return false;
                return true;
            })
            .sort((a, b) => (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0) || a.prompt.localeCompare(b.prompt));
    }, [questions, debouncedSearch, typeFilter, difficultyFilter, statusFilter]);

    const handleSave = (input: CreateQuestionInput | UpdateQuestionInput, id?: string) => {
        if (id) {
            onUpdate(id, input as UpdateQuestionInput);
        } else {
            onCreate(input as CreateQuestionInput);
        }
    };

    const openCreate = () => {
        setEditTarget(null);
        setEditorOpen(true);
    };

    const openEdit = (question: Question) => {
        setEditTarget(question);
        setEditorOpen(true);
    };

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.filterBar)}>
                <div {...stylex.props(styles.searchField)}>
                    <Input
                        label="Search questions"
                        labelHidden
                        startIcon={<Search size={16} />}
                        placeholder="Search questions…"
                        value={search}
                        onChange={setSearch}
                        clearable
                        size="sm"
                    />
                </div>
                <Selector
                    label="Filter by type"
                    isLabelHidden
                    options={TYPE_OPTIONS}
                    value={typeFilter}
                    onChange={(v) => setTypeFilter(v as QuestionType | '')}
                    size="sm"
                    width={160}
                />
                <Selector
                    label="Filter by difficulty"
                    isLabelHidden
                    options={DIFFICULTY_OPTIONS}
                    value={difficultyFilter}
                    onChange={(v) => setDifficultyFilter(v as QuestionDifficulty | '')}
                    size="sm"
                    width={150}
                />
                <Selector
                    label="Filter by status"
                    isLabelHidden
                    options={STATUS_OPTIONS}
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as QuestionStatus | '')}
                    size="sm"
                    width={150}
                />
                <Button
                    label="New question"
                    variant="primary"
                    icon={<Plus size={14} />}
                    onClick={openCreate}
                    {...stylex.props(styles.newQuestionButton)}
                >
                    New Question
                </Button>
            </div>

            {questions.length === 0 ? (
                <div {...stylex.props(styles.empty)}>
                    <Inbox size={40} />
                    <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>Start building your question bank</p>
                    <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 12px 0', fontSize: 13 }}>
                        Add questions to build your material's question bank and create quizzes.
                    </p>
                    <Button
                        label="Create first question"
                        variant="primary"
                        icon={<Plus size={14} />}
                        onClick={openCreate}
                    >
                        Create First Question
                    </Button>
                </div>
            ) : filtered.length === 0 ? (
                <div {...stylex.props(styles.empty)}>
                    <Inbox size={40} />
                    <p>No questions match your filters.</p>
                </div>
            ) : (
                <div {...stylex.props(styles.list)}>
                    {filtered.map((q) => {
                        const usageCount = quizzes.filter((quiz) => quiz.questionIds.includes(q.id)).length;

                        const handleArchiveClick = () => {
                            if (usageCount > 0) {
                                setPendingArchiveId(q.id);
                            } else {
                                onArchive(q.id);
                                showToast('Question moved to archive', { intent: 'info' });
                            }
                        };

                        return (
                            <Card key={q.id} style={{ padding: 16, border: `2px solid ${statusBorderColor(q.status)}` }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                    <div {...stylex.props(styles.cardContent)}>
                                        <div {...stylex.props(styles.promptRow)}>
                                            <p {...stylex.props(styles.prompt)}>{q.prompt}</p>
                                        </div>
                                        <div {...stylex.props(styles.badgesRow)}>
                                            <span {...stylex.props(styles.badgedot, typeBadgeStyle(q.type))}>{TYPE_LABELS[q.type]}</span>
                                            <span {...stylex.props(styles.badgedot, difficultyBadgeStyle(q.difficulty))}>{q.difficulty}</span>
                                            <span {...stylex.props(styles.badgedot, styles.badgePoints)}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                                            <span {...stylex.props(
                                                styles.badgedot,
                                                q.status === 'published' && styles.badgePublished,
                                                q.status === 'draft' && styles.badgeDraft,
                                                q.status === 'archived' && styles.badgeArchived,
                                            )}>{q.status}</span>
                                            <span {...stylex.props(
                                                styles.badgedot,
                                                usageCount > 0 ? styles.badgeUsed : styles.badgeUnused,
                                            )}>{usageCount > 0 ? `Used in ${usageCount} ${usageCount === 1 ? 'quiz' : 'quizzes'}` : 'Not used in any quiz'}</span>
                                            <span style={{ fontSize: 11, color: 'var(--color-text-disabled)' }}>v{q.version}</span>
                                        </div>

                                        {q.payload && (
                                            <div {...stylex.props(styles.detailSection)}>
                                                <QuestionPayloadPreview payload={q.payload} />
                                            </div>
                                        )}

                                        {q.explanation && (
                                            <div {...stylex.props(styles.detailSection)}>
                                                <div {...stylex.props(styles.detailLabel)}>Explanation</div>
                                                <p {...stylex.props(styles.explanationPreview)}>{q.explanation}</p>
                                            </div>
                                        )}

                                        {q.tags && q.tags.length > 0 && (
                                            <div {...stylex.props(styles.tagsRow)}>
                                                {q.tags.map((tag) => (
                                                    <span key={tag} {...stylex.props(styles.tag)}>#{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div {...stylex.props(styles.cardActions)}>
                                        {q.status === 'draft' && (
                                            <Button
                                                label={`Publish question: ${q.prompt}`}
                                                variant="secondary"
                                                icon={<CheckCircle size={14} />}
                                                isIconOnly
                                                tooltip="Publish"
                                                onClick={() => { onPublish(q.id); showToast('Question published', { intent: 'success' }); }}
                                            />
                                        )}
                                        <Button
                                            label={`Edit question: ${q.prompt}`}
                                            variant="secondary"
                                            icon={<Pencil size={14} />}
                                            isIconOnly
                                            tooltip="Edit"
                                            onClick={() => openEdit(q)}
                                        />
                                        {q.status === 'archived' && onUnarchive ? (
                                            <Button
                                                label={`Restore question: ${q.prompt}`}
                                                variant="secondary"
                                                icon={<ArchiveRestore size={14} />}
                                                isIconOnly
                                                tooltip="Restore"
                                                onClick={() => { onUnarchive(q.id); showToast('Question restored to draft', { intent: 'success' }); }}
                                            />
                                        ) : (
                                            <Button
                                                label={`Archive question: ${q.prompt}`}
                                                variant="danger"
                                                icon={<Archive size={14} />}
                                                isIconOnly
                                                tooltip="Archive"
                                                onClick={handleArchiveClick}
                                            />
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <QuestionEditorDialog
                key={editTarget?.id ?? 'new-question'}
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                materialId={materialId}
                question={editTarget}
                onSave={handleSave}
            />

            <ConfirmationDialog
                isOpen={pendingArchiveId !== null}
                title="Archive question?"
                message={`This question is used in ${quizzes.filter((q) => q.questionIds.includes(pendingArchiveId ?? '')).length} ${quizzes.filter((q) => q.questionIds.includes(pendingArchiveId ?? '')).length === 1 ? 'quiz' : 'quizzes'} — archiving will affect those quizzes. Are you sure?`}
                confirmLabel="Archive"
                intent="danger"
                onConfirm={() => {
                    if (pendingArchiveId) {
                        onArchive(pendingArchiveId);
                        showToast('Question moved to archive', { intent: 'info' });
                        setPendingArchiveId(null);
                    }
                }}
                onCancel={() => setPendingArchiveId(null)}
            />
        </div>
    );
}
