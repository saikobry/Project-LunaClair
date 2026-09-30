import { useState, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Pencil, Archive, ArchiveRestore, CheckCircle, Inbox, Plus } from 'lucide-react';
import { DIFFICULTY_APPEARANCE, POINTS_APPEARANCE, QUESTION_TYPE_APPEARANCE } from '../utils/quizBadgeAppearance';
import type { Question, QuestionStatus, QuestionDifficulty } from '../../../domain/quiz/models/Question';
import type { QuestionType } from '../../../domain/quiz/models/QuestionType';
import type { CreateQuestionInput, UpdateQuestionInput } from '../../../domain/quiz/repositories/QuestionRepository';
import type { SaveQuestionResult } from '../../../application/use-cases/quiz-management/CreateQuestionUseCase';
import { QUESTION_TYPE_LABELS } from '../../../domain/quiz/models/questionMetadata';
import type { MaterialWorkspaceTab } from '../../../app/routing/routing';
import { Button } from '../../../shared/ui/Button/Button';
import { Card } from '../../../shared/ui/Card/Card';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { useToast } from '../../../app/providers/ToastContext';
import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';
import { QuestionEditorDialog } from './QuestionEditorDialog';
import { QuestionBankFilterBar } from './QuestionBankFilterBar';
import { QuestionPayloadPreview } from './QuestionPayloadPreview';
import { AiQuestionGeneratorDialog } from '../../ai/generator/components/AiQuestionGeneratorDialog';
import { useGeneratorLaunchClaim, type GeneratorLaunchChannel } from '../hooks/useGeneratorLaunchClaim';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { styles } from './questionBank.stylex';

const STATUS_RANK: Record<string, number> = { published: 0, draft: 1, archived: 2 };

interface QuestionBankTabProps {
    questions: Question[];
    quizzes?: import('../../../domain/quiz/models/Quiz').Quiz[];
    materialId: string;
    materialTitle?: string;
    documentMarkdown?: string;
    // Both resolve to the write boundary's result: a refused write is a fact the editor
    // renders, so the promise has to reach it rather than being fired and forgotten.
    onCreate: (input: CreateQuestionInput) => Promise<SaveQuestionResult>;
    onUpdate: (id: string, input: UpdateQuestionInput) => Promise<SaveQuestionResult>;
    onPublish: (id: string) => void;
    onArchive: (id: string) => void;
    onUnarchive?: (id: string) => void;
    onRefresh?: () => void;
    /**
     * Returns the workspace to a sibling tab, offered on the generator's done step when
     * this Bank was reached through a launch intent. Wired to the workspace's ordinary tab
     * change, so the return keeps the `?from=` origin and the mode tier the tab implies.
     */
    onReturnToTab?: (tab: MaterialWorkspaceTab) => void;
    /**
     * The workspace screen's one-shot launch intent for this material: the pending request
     * plus the single command that retires it. The Bank reads it and retires it; it never
     * authors on the strength of one, and a `null` intent is the ordinary case (the Bank's
     * own "Generate with AI" needs no launch at all).
     */
    generatorLaunch: GeneratorLaunchChannel;
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
    /** The Bank's active tag filter — a chip is pressed because it is in this set. */
    selectedTagSet: ReadonlySet<string>;
    onEdit: (question: Question) => void;
    onPublish: (question: Question) => void;
    onArchiveRequest: (question: Question, usageCount: number) => void;
    onUnarchive: ((question: Question) => void) | undefined;
    onTagClick: (tag: string) => void;
}

interface QuestionCardActionsProps {
    question: Question;
    usageCount: number;
    onEdit: (question: Question) => void;
    onPublish: (question: Question) => void;
    onArchiveRequest: (question: Question, usageCount: number) => void;
    onUnarchive: ((question: Question) => void) | undefined;
}

function QuestionCardActions({
    question: q,
    usageCount,
    onEdit,
    onPublish,
    onArchiveRequest,
    onUnarchive,
}: QuestionCardActionsProps) {
    return (
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
    );
}

function QuestionBankCard({
    question: q,
    usageCount,
    selectedTagSet,
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
                        {QUESTION_TYPE_LABELS[q.type]}
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
                        {q.tags.map((tag) => {
                            // Toggle state, not decoration: the pressed chip is the active filter,
                            // and it is active because it is IN the selected set — not because a
                            // search string happens to look like it.
                            const isActiveTag = selectedTagSet.has(tag);
                            return (
                                <button
                                    key={tag}
                                    type="button"
                                    title={`Filter by tag: ${tag}`}
                                    aria-pressed={isActiveTag}
                                    onClick={() => onTagClick(tag)}
                                    {...stylex.props(
                                        styles.tag,
                                        isActiveTag && styles.tagPressed,
                                    )}
                                >
                                    #{tag}
                                </button>
                            );
                        })}
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
                    <QuestionCardActions
                        question={q}
                        usageCount={usageCount}
                        onEdit={onEdit}
                        onPublish={onPublish}
                        onArchiveRequest={onArchiveRequest}
                        onUnarchive={onUnarchive}
                    />
                </div>
            </div>
        </Card>
    );
}

export function QuestionBankTab({
    questions,
    quizzes = [],
    materialId,
    materialTitle,
    documentMarkdown,
    onCreate,
    onUpdate,
    onPublish,
    onArchive,
    onUnarchive,
    onRefresh,
    generatorLaunch,
    onReturnToTab,
}: QuestionBankTabProps) {
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    // The Bank's tag filter is its own state — a multi-select set, exactly like the Material
    // Library's. Chips toggle membership here and NEVER write into the search field, so the two
    // mechanisms are independent: clearing the search cannot clear the tag filter, and toggling a
    // tag cannot change the search text. Matching is OR across selected tags (a question is shown
    // if it carries ANY selected tag), mirroring the Library's per-chip `isActive` model.
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    // A Set for membership tests: the array is toggled, but both the list predicate and every
    // card's chip loop test membership, so the lookups belong on a Set (not `Array.includes`).
    const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);
    const [typeFilter, setTypeFilter] = useState<QuestionType | ''>('');
    const [difficultyFilter, setDifficultyFilter] = useState<QuestionDifficulty | ''>('');
    const [statusFilter, setStatusFilter] = useState<QuestionStatus | ''>('');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Question | null>(null);
    const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);

    // A launch intent addressed to THIS material opens the one generator dialog with its types
    // preselected and a way back to the tab that asked; the claim is one-shot, so returning
    // here later opens nothing. All of that lives in the hook — this tab only decides when the
    // dialog is open and what to hand it.
    const generator = useGeneratorLaunchClaim(materialId, generatorLaunch, onReturnToTab);

    const activeFilterCount = [typeFilter, difficultyFilter, statusFilter].filter(Boolean).length;

    // Leading '#' is stripped so typing '#skin' or 'skin' both find tag 'skin'.
    const searchQuery = debouncedSearch.trim().toLowerCase().replace(/^#/, '');

    // Tag facet for the filter bar — the same derivation the Material Library uses: unique tags of
    // the questions in scope, ranked by how many carry them (desc), alphabetical tiebreak. A
    // selected tag is appended even when the in-scope set no longer carries it, so an active filter
    // keeps its deselect affordance; the bar's capped row pins it in place on top of that.
    const allTags = useMemo(() => {
        const counts = new Map<string, number>();
        questions.forEach((q) => q.tags?.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
        const ranked = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([tag]) => tag);
        if (selectedTags.length === 0) return ranked;
        const rankedSet = new Set(ranked);
        return [...ranked, ...selectedTags.filter((t) => !rankedSet.has(t))];
    }, [questions, selectedTags]);

    const filtered = useMemo(() => {
        return questions
            .filter((q) => {
                if (searchQuery) {
                    const matchesPrompt = q.prompt.toLowerCase().includes(searchQuery);
                    const matchesTags = (q.tags ?? []).some((t) => t.toLowerCase().includes(searchQuery));
                    if (!matchesPrompt && !matchesTags) return false;
                }
                // Tag filter, OR within the facet: a question survives if it carries any selected
                // tag. AND across facets (search, tag, type, difficulty, status), as in the Library.
                if (
                    selectedTags.length > 0 &&
                    !(q.tags ?? []).some((t) => selectedTagSet.has(t))
                ) {
                    return false;
                }
                if (typeFilter && q.type !== typeFilter) return false;
                if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
                if (statusFilter && q.status !== statusFilter) return false;
                return true;
            })
            .sort((a, b) => (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[a.status] ?? 0) || a.prompt.localeCompare(b.prompt));
    }, [questions, searchQuery, selectedTags, selectedTagSet, typeFilter, difficultyFilter, statusFilter]);

    const handleSave = (input: CreateQuestionInput | UpdateQuestionInput, id?: string) => {
        if (id) {
            return onUpdate(id, input as UpdateQuestionInput);
        }
        return onCreate(input as CreateQuestionInput);
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
        // Toggle membership in the selected set. This deliberately does NOT touch `search`:
        // the search field and the tag filter are independent controls that happen to narrow the
        // same list. Selecting a second tag adds to the set rather than replacing the first, so
        // two tags narrow by both (OR).
        setSelectedTags((current) =>
            current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
        );
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
            <QuestionBankFilterBar
                search={search}
                onSearchChange={setSearch}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
                difficultyFilter={difficultyFilter}
                onDifficultyFilterChange={setDifficultyFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                allTags={allTags}
                selectedTags={selectedTags}
                onToggleTag={handleTagClick}
                activeFilterCount={activeFilterCount}
                canGenerate={Boolean(documentMarkdown)}
                onOpenGenerator={generator.open}
                onCreateQuestion={openCreate}
            />

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
                                setSelectedTags([]);
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
                                selectedTagSet={selectedTagSet}
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

            {generator.isOpen && (
                <AiQuestionGeneratorDialog
                    isOpen
                    onClose={generator.close}
                    materialId={materialId}
                    materialTitle={materialTitle || 'Study Material'}
                    initialTypes={generator.initialTypes}
                    returnAction={
                        generator.returnLabel
                            ? { label: generator.returnLabel, onReturn: generator.returnToLauncher }
                            : undefined
                    }
                    onSuccess={(createdCount) => {
                        showToast(`Added ${createdCount} questions to Question Bank in Draft status`, { intent: 'success' });
                        if (onRefresh) {
                            onRefresh();
                        }
                    }}
                />
            )}
        </div>
    );
}
