import { useState, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Pencil, Archive, ArchiveRestore, CheckCircle, Inbox, Plus, Search, Filter } from 'lucide-react';
import { DIFFICULTY_APPEARANCE, POINTS_APPEARANCE, QUESTION_TYPE_APPEARANCE } from '../../../domain/quiz/quizBadgeAppearance';
import type { Question, QuestionStatus, QuestionDifficulty } from '../../../domain/quiz/Question';
import type { QuestionType } from '../../../domain/quiz/QuestionType';
import type { CreateQuestionInput, UpdateQuestionInput } from '../../../domain/quiz/QuestionRepository';
import { Button } from '../../../shared/ui/Button/Button';
import { Input } from '../../../shared/ui/Input/Input';
import { Card } from '../../../shared/ui/Card/Card';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { Selector, type SelectorOption } from '../../../shared/ui/Selector/Selector';
import { useToast } from '../../../app/providers/ToastContext';
import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';
import { QuestionEditorDialog } from './QuestionEditorDialog';
import { QuestionPayloadPreview } from './QuestionPayloadPreview';
import { useDebounce } from '../../../shared/hooks/useDebounce';

const desktopQuery = '@media (min-width: 769px)';

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
        alignItems: 'center',
    },
    searchField: {
        flex: 1,
        minWidth: 180,
    },
    desktopSelectors: {
        display: 'none',
        [desktopQuery]: {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
        },
    },
    mobileFilterTrigger: {
        display: 'flex',
        [desktopQuery]: {
            display: 'none',
        },
    },
    mobileFilterPanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        padding: 12,
        backgroundColor: 'var(--color-background-surface, #ffffff)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxSizing: 'border-box',
        [desktopQuery]: {
            display: 'none',
        },
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
        justifyContent: 'space-between',
        gap: 12,
    },
    prompt: {
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        margin: 0,
        lineHeight: 1.5,
        flex: 1,
        minWidth: 0,
    },
    topRightStatusBadge: {
        flexShrink: 0,
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
        textTransform: 'capitalize',
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
    cardFooter: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        paddingTop: 10,
        marginTop: 6,
        borderTop: '1px solid var(--color-border)',
    },
    cardFooterMeta: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    versionTag: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-disabled)',
    },
    cardActions: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        marginLeft: 'auto',
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
        textTransform: 'capitalize',
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
    badgeUsed: {
        backgroundColor: 'var(--color-accent-muted)',
        color: 'var(--color-accent)',
    },
    badgeUnused: {
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-disabled)',
    },
    tag: {
        fontSize: 10.5,
        padding: '1px 7px',
        border: 'none',
        borderRadius: 4,
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease, color 0.15s ease',
        ':hover': {
            backgroundColor: 'var(--color-accent-muted)',
            color: 'var(--color-accent)',
        },
        ':active': {
            opacity: 0.8,
        },
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

interface QuestionBankCardProps {
    question: Question;
    usageCount: number;
    /** Live search query (lowercased, leading '#' stripped) — drives tag-chip pressed state. */
    activeTagQuery: string;
    onEdit: (question: Question) => void;
    onPublish: (question: Question) => void;
    onArchiveRequest: (question: Question, usageCount: number) => void;
    onUnarchive: ((question: Question) => void) | undefined;
    onTagClick: (tag: string) => void;
}

function QuestionBankCard({
    question: q,
    usageCount,
    activeTagQuery,
    onEdit,
    onPublish,
    onArchiveRequest,
    onUnarchive,
    onTagClick,
}: QuestionBankCardProps) {
    return (
        <Card style={{ padding: 16, border: `2px solid ${statusBorderColor(q.status)}` }}>
            <div {...stylex.props(styles.cardContent)}>
                <div {...stylex.props(styles.promptRow)}>
                    <p {...stylex.props(styles.prompt)}>{q.prompt}</p>
                    <span {...stylex.props(
                        styles.badgedot,
                        styles.topRightStatusBadge,
                        q.status === 'published' && styles.badgePublished,
                        q.status === 'draft' && styles.badgeDraft,
                        q.status === 'archived' && styles.badgeArchived,
                    )}>{q.status}</span>
                </div>
                <div {...stylex.props(styles.badgesRow)}>
                    <span
                        {...stylex.props(styles.badgedot)}
                        style={{
                            backgroundColor: POINTS_APPEARANCE.bg,
                            color: POINTS_APPEARANCE.fg,
                        }}
                    >
                        {q.points} pt{q.points !== 1 ? 's' : ''}
                    </span>
                    <span
                        {...stylex.props(styles.badgedot)}
                        style={{
                            backgroundColor: DIFFICULTY_APPEARANCE[q.difficulty].bg,
                            color: DIFFICULTY_APPEARANCE[q.difficulty].fg,
                        }}
                    >
                        {q.difficulty}
                    </span>
                    <span
                        {...stylex.props(styles.badgedot)}
                        style={{
                            backgroundColor: QUESTION_TYPE_APPEARANCE[q.type].bg,
                            color: QUESTION_TYPE_APPEARANCE[q.type].fg,
                        }}
                    >
                        {TYPE_LABELS[q.type]}
                    </span>
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
                            <button
                                key={tag}
                                type="button"
                                title={`Filter by tag: ${tag}`}
                                aria-pressed={activeTagQuery === tag.toLowerCase()}
                                onClick={() => onTagClick(tag)}
                                {...stylex.props(styles.tag)}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}

                <div {...stylex.props(styles.cardFooter)}>
                    <div {...stylex.props(styles.cardFooterMeta)}>
                        <span {...stylex.props(styles.versionTag)}>v{q.version}</span>
                        <span {...stylex.props(
                            styles.badgedot,
                            usageCount > 0 ? styles.badgeUsed : styles.badgeUnused,
                        )}>{usageCount > 0 ? `Used in ${usageCount} ${usageCount === 1 ? 'quiz' : 'quizzes'}` : 'Not used in any quiz'}</span>
                    </div>
                    <div {...stylex.props(styles.cardActions)}>
                        {q.status === 'draft' && (
                            <Button
                                label={`Publish question: ${q.prompt}`}
                                variant="secondary"
                                icon={<CheckCircle size={14} />}
                                isIconOnly
                                tooltip="Publish"
                                onClick={() => onPublish(q)}
                            />
                        )}
                        <Button
                            label={`Edit question: ${q.prompt}`}
                            variant="secondary"
                            icon={<Pencil size={14} />}
                            isIconOnly
                            tooltip="Edit"
                            onClick={() => onEdit(q)}
                        />
                        {q.status === 'archived' && onUnarchive ? (
                            <Button
                                label={`Restore question: ${q.prompt}`}
                                variant="secondary"
                                icon={<ArchiveRestore size={14} />}
                                isIconOnly
                                tooltip="Restore"
                                onClick={() => onUnarchive(q)}
                            />
                        ) : (
                            <Button
                                label={`Archive question: ${q.prompt}`}
                                variant="danger"
                                icon={<Archive size={14} />}
                                isIconOnly
                                tooltip="Archive"
                                onClick={() => onArchiveRequest(q, usageCount)}
                            />
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
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
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Question | null>(null);
    const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);

    const activeFilterCount = [typeFilter, difficultyFilter, statusFilter].filter(Boolean).length;

    // Leading '#' is stripped so typing '#skin' or 'skin' both find tag 'skin'.
    const searchQuery = debouncedSearch.trim().toLowerCase().replace(/^#/, '');
    // Live (non-debounced) query — chip toggles and pressed state must respond
    // immediately, not after the 300ms debounce window.
    const activeTagQuery = search.trim().toLowerCase().replace(/^#/, '');

    const filtered = useMemo(() => {
        return questions
            .filter((q) => {
                if (searchQuery) {
                    const matchesPrompt = q.prompt.toLowerCase().includes(searchQuery);
                    const matchesTags = (q.tags ?? []).some((t) => t.toLowerCase().includes(searchQuery));
                    if (!matchesPrompt && !matchesTags) return false;
                }
                if (typeFilter && q.type !== typeFilter) return false;
                if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
                if (statusFilter && q.status !== statusFilter) return false;
                return true;
            })
            .sort((a, b) => (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[a.status] ?? 0) || a.prompt.localeCompare(b.prompt));
    }, [questions, searchQuery, typeFilter, difficultyFilter, statusFilter]);

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

    const handleTagClick = (tag: string) => {
        // Clicking the already-active tag clears the filter; any other tag filters by it.
        const isActive = activeTagQuery === tag.toLowerCase();
        setSearch(isActive ? '' : `#${tag}`);
    };

    const handlePublish = (question: Question) => {
        onPublish(question.id);
        showToast('Question published', { intent: 'success' });
    };

    const handleUnarchive = onUnarchive
        ? (question: Question) => {
              onUnarchive(question.id);
              showToast('Question restored to draft', { intent: 'success' });
          }
        : undefined;

    const handleArchiveRequest = (question: Question, usageCount: number) => {
        if (usageCount > 0) {
            setPendingArchiveId(question.id);
        } else {
            onArchive(question.id);
            showToast('Question moved to archive', { intent: 'info' });
        }
    };

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.filterBar)}>
                <div {...stylex.props(styles.searchField)}>
                    <Input
                        label="Search questions"
                        labelHidden
                        startIcon={<Search size={16} />}
                        placeholder="Search prompts and tags…"
                        value={search}
                        onChange={setSearch}
                        clearable
                        size="sm"
                    />
                </div>
                <div {...stylex.props(styles.desktopSelectors)}>
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
                </div>
                <div {...stylex.props(styles.mobileFilterTrigger)}>
                    <Button
                        label="Toggle filters"
                        variant={activeFilterCount > 0 ? 'primary' : 'secondary'}
                        icon={<Filter size={14} />}
                        onClick={() => setMobileFilterOpen((prev) => !prev)}
                    >
                        Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </Button>
                </div>
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

            {mobileFilterOpen && (
                <div {...stylex.props(styles.mobileFilterPanel)}>
                    <Selector
                        label="Filter by type"
                        options={TYPE_OPTIONS}
                        value={typeFilter}
                        onChange={(v) => setTypeFilter(v as QuestionType | '')}
                        size="sm"
                    />
                    <Selector
                        label="Filter by difficulty"
                        options={DIFFICULTY_OPTIONS}
                        value={difficultyFilter}
                        onChange={(v) => setDifficultyFilter(v as QuestionDifficulty | '')}
                        size="sm"
                    />
                    <Selector
                        label="Filter by status"
                        options={STATUS_OPTIONS}
                        value={statusFilter}
                        onChange={(v) => setStatusFilter(v as QuestionStatus | '')}
                        size="sm"
                    />
                </div>
            )}

            {questions.length === 0 ? (
                <EmptyState
                    icon={<Inbox size={28} />}
                    title="Start building your question bank"
                    description="Add questions to build your material's question bank and create quizzes."
                    headingLevel="h3"
                    action={
                        <Button
                            label="Create first question"
                            variant="primary"
                            icon={<Plus size={14} />}
                            onClick={openCreate}
                        >
                            Create First Question
                        </Button>
                    }
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={<Inbox size={24} />}
                    iconVariant="muted"
                    title="No questions found"
                    description="No questions match your search or active filters."
                    headingLevel="h3"
                    action={
                        <Button
                            label="Clear filters"
                            variant="secondary"
                            onClick={() => {
                                setSearch('');
                                setTypeFilter('');
                                setDifficultyFilter('');
                                setStatusFilter('');
                            }}
                        >
                            Clear filters
                        </Button>
                    }
                />
            ) : (
                <div {...stylex.props(styles.list)}>
                    {filtered.map((q) => {
                        const usageCount = quizzes.filter((quiz) => quiz.questionIds.includes(q.id)).length;
                        return (
                            <QuestionBankCard
                                key={q.id}
                                question={q}
                                usageCount={usageCount}
                                activeTagQuery={activeTagQuery}
                                onEdit={openEdit}
                                onPublish={handlePublish}
                                onArchiveRequest={handleArchiveRequest}
                                onUnarchive={handleUnarchive}
                                onTagClick={handleTagClick}
                            />
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
