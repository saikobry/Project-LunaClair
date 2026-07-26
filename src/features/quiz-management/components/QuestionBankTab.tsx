import { useState, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Search, Pencil, Archive, CheckCircle, Inbox } from 'lucide-react';
import type { Question, QuestionStatus } from '../../../domain/quiz/Question';
import type { QuestionType } from '../../../domain/quiz/QuestionType';
import type { QuestionDifficulty } from '../../../domain/quiz/Question';
import type { CreateQuestionInput, UpdateQuestionInput } from '../../../domain/quiz/QuestionRepository';
import { Button } from '../../../shared/ui/Button';
import { QuestionEditorDialog } from './QuestionEditorDialog';

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
    searchInput: {
        flex: 1,
        minWidth: 180,
        padding: '8px 12px',
        fontSize: 14,
        border: '1px solid #e5e4e7',
        borderRadius: 8,
        color: '#08060d',
        backgroundColor: '#ffffff',
    },
    select: {
        padding: '8px 12px',
        fontSize: 13,
        border: '1px solid #e5e4e7',
        borderRadius: 8,
        backgroundColor: '#ffffff',
        color: '#08060d',
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
        backgroundColor: '#ffffff',
        border: '1px solid #e5e4e7',
        borderRadius: 10,
    },
    cardContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flex: 1,
    },
    prompt: {
        fontSize: 14,
        fontWeight: 500,
        color: '#08060d',
        margin: 0,
    },
    badges: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
    },
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 5,
        backgroundColor: '#f3f2f5',
        color: '#6b6375',
    },
    badgePublished: {
        backgroundColor: '#dcfce7',
        color: '#166534',
    },
    badgeDraft: {
        backgroundColor: '#fef9c3',
        color: '#854d0e',
    },
    badgeArchived: {
        backgroundColor: '#f3f2f5',
        color: '#9f95a9',
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
        color: '#6b6375',
        textAlign: 'center',
    },
    version: {
        fontSize: 11,
        color: '#9f95a9',
    },
});

const TYPE_LABELS: Record<QuestionType, string> = {
    multiple_choice: 'MC',
    multiple_select: 'MS',
    true_false: 'T/F',
    identification: 'ID',
    fill_in_blank: 'FB',
};

interface QuestionBankTabProps {
    questions: Question[];
    materialId: string;
    onCreate: (input: CreateQuestionInput) => void;
    onUpdate: (id: string, input: UpdateQuestionInput) => void;
    onPublish: (id: string) => void;
    onArchive: (id: string) => void;
}

export function QuestionBankTab({
    questions,
    materialId,
    onCreate,
    onUpdate,
    onPublish,
    onArchive,
}: QuestionBankTabProps) {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<QuestionType | ''>('');
    const [difficultyFilter, setDifficultyFilter] = useState<QuestionDifficulty | ''>('');
    const [statusFilter, setStatusFilter] = useState<QuestionStatus | ''>('');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Question | null>(null);

    const filtered = useMemo(() => {
        return questions.filter((q) => {
            if (search && !q.prompt.toLowerCase().includes(search.toLowerCase())) return false;
            if (typeFilter && q.type !== typeFilter) return false;
            if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
            if (statusFilter && q.status !== statusFilter) return false;
            return true;
        });
    }, [questions, search, typeFilter, difficultyFilter, statusFilter]);

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

    const statusBadgeStyle = (status: QuestionStatus) => {
        switch (status) {
            case 'published': return styles.badgePublished;
            case 'draft': return styles.badgeDraft;
            case 'archived': return styles.badgeArchived;
        }
    };

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.filterBar)}>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search questions…"
                    {...stylex.props(styles.searchInput)}
                    aria-label="Search questions"
                />
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as QuestionType | '')}
                    {...stylex.props(styles.select)}
                    aria-label="Filter by type"
                >
                    <option value="">All types</option>
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="multiple_select">Multiple Select</option>
                    <option value="true_false">True/False</option>
                    <option value="identification">Identification</option>
                    <option value="fill_in_blank">Fill in Blank</option>
                </select>
                <select
                    value={difficultyFilter}
                    onChange={(e) => setDifficultyFilter(e.target.value as QuestionDifficulty | '')}
                    {...stylex.props(styles.select)}
                    aria-label="Filter by difficulty"
                >
                    <option value="">All difficulty</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as QuestionStatus | '')}
                    {...stylex.props(styles.select)}
                    aria-label="Filter by status"
                >
                    <option value="">All status</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                </select>
                <Button
                    label="New question"
                    variant="primary"
                    icon={<Search size={14} />}
                    onClick={openCreate}
                >
                    + New Question
                </Button>
            </div>

            {filtered.length === 0 ? (
                <div {...stylex.props(styles.empty)}>
                    <Inbox size={40} />
                    <p>No questions match your filters.</p>
                </div>
            ) : (
                <div {...stylex.props(styles.list)}>
                    {filtered.map((q) => (
                        <div key={q.id} {...stylex.props(styles.card)}>
                            <div {...stylex.props(styles.cardContent)}>
                                <p {...stylex.props(styles.prompt)}>{q.prompt}</p>
                                <div {...stylex.props(styles.badges)}>
                                    <span {...stylex.props(styles.badge)}>{TYPE_LABELS[q.type]}</span>
                                    <span {...stylex.props(styles.badge)}>{q.difficulty}</span>
                                    <span {...stylex.props(styles.badge)}>{q.points} pt</span>
                                    <span {...stylex.props(styles.badge, statusBadgeStyle(q.status))}>{q.status}</span>
                                    <span {...stylex.props(styles.version)}>v{q.version}</span>
                                </div>
                            </div>
                            <div {...stylex.props(styles.cardActions)}>
                                {q.status === 'draft' && (
                                    <Button
                                        label={`Publish question: ${q.prompt}`}
                                        variant="secondary"
                                        icon={<CheckCircle size={14} />}
                                        isIconOnly
                                        onClick={() => onPublish(q.id)}
                                    />
                                )}
                                <Button
                                    label={`Edit question: ${q.prompt}`}
                                    variant="secondary"
                                    icon={<Pencil size={14} />}
                                    isIconOnly
                                    onClick={() => openEdit(q)}
                                />
                                {q.status !== 'archived' && (
                                    <Button
                                        label={`Archive question: ${q.prompt}`}
                                        variant="danger"
                                        icon={<Archive size={14} />}
                                        isIconOnly
                                        onClick={() => onArchive(q.id)}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
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
        </div>
    );
}
