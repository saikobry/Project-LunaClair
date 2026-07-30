import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { Question } from '../../../domain/quiz/Question';
import type { Quiz } from '../../../domain/quiz/Quiz';
import type { CreateQuizInput, UpdateQuizInput } from '../../../domain/quiz/QuizRepository';
import { Dialog } from '../../../shared/ui/Dialog';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { useToast } from '../../../app/providers/ToastContext';

const styles = stylex.create({
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    questionList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 280,
        overflowY: 'auto',
    },
    questionRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        fontSize: 13,
        color: 'var(--color-text-primary)',
    },
    questionRowSelected: {
        borderColor: 'var(--color-accent)',
        backgroundColor: 'var(--color-accent-muted)',
        fontWeight: 600,
        boxShadow: 'var(--shadow-med)',
    },
    questionPrompt: {
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    questionVersion: {
        fontSize: 11,
        color: 'var(--color-text-disabled)',
        flexShrink: 0,
    },
    reorderButtons: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flexShrink: 0,
    },
    reorderBtn: {
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        padding: 2,
        color: 'var(--color-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 4,
        ':hover': {
            backgroundColor: 'var(--color-background-muted)',
            color: 'var(--color-accent)',
        },
    },
    checkbox: {
        width: 15,
        height: 15,
        accentColor: 'var(--color-accent)',
        cursor: 'pointer',
        flexShrink: 0,
    },
    hint: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
});

interface QuizBuilderDialogProps {
    isOpen: boolean;
    onClose: () => void;
    materialId: string;
    questions: Question[];
    quiz?: Quiz | null;
    onSave: (input: CreateQuizInput, questions: Question[]) => void;
    onUpdate?: (id: string, input: UpdateQuizInput) => void;
}

export function QuizBuilderDialog({
    isOpen,
    onClose,
    materialId,
    questions,
    quiz,
    onSave,
    onUpdate,
}: QuizBuilderDialogProps) {
    const { showToast } = useToast();
    const isEditing = !!quiz;
    const [title, setTitle] = useState(quiz?.title ?? '');
    const [description, setDescription] = useState(quiz?.description ?? '');
    const [passingPercentage, setPassingPercentage] = useState(
        String(quiz?.passingPercentage ?? 70),
    );
    const [selectedIds, setSelectedIds] = useState<string[]>(
        quiz?.questionIds ?? [],
    );

    const availableQuestions = questions.filter((q) => q.status !== 'archived');

    const toggleQuestion = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((qid) => qid !== id) : [...prev, id],
        );
    };

    const moveUp = (index: number) => {
        if (index === 0) return;
        const updated = [...selectedIds];
        [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
        setSelectedIds(updated);
    };

    const moveDown = (index: number) => {
        if (index === selectedIds.length - 1) return;
        const updated = [...selectedIds];
        [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
        setSelectedIds(updated);
    };

    const handleSave = () => {
        const parsedPassing = Math.min(100, Math.max(0, parseInt(passingPercentage, 10) || 70));

        if (isEditing && quiz && onUpdate) {
            const input: UpdateQuizInput = {
                title,
                description: description || undefined,
                questionIds: selectedIds,
                passingPercentage: parsedPassing,
            };
            onUpdate(quiz.id, input);
            showToast('Quiz updated', { intent: 'success' });
        } else {
            const input: CreateQuizInput = {
                materialId,
                title,
                description: description || undefined,
                questionIds: selectedIds,
                passingPercentage: parsedPassing,
            };
            onSave(input, availableQuestions);
            showToast('Quiz saved to catalog', { intent: 'success' });
        }
        onClose();
    };

    const selectedSet = new Set(selectedIds);

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Quiz' : 'Create Quiz'}
            width={560}
            maxHeight="85vh"
            purpose="form"
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <Button label="Cancel" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        label={isEditing ? 'Save changes' : 'Create quiz'}
                        variant="primary"
                        isDisabled={!title.trim() || selectedIds.length === 0}
                        onClick={handleSave}
                    >
                        {isEditing ? 'Save Changes' : 'Create Quiz'}
                    </Button>
                </div>
            }
        >
            <div {...stylex.props(styles.form)}>
                <Input
                    label="Quiz title"
                    value={title}
                    onChange={setTitle}
                    placeholder="e.g. Chapter 4 Review Quiz"
                    required
                />

                <Input
                    label="Description (optional)"
                    value={description}
                    onChange={setDescription}
                    placeholder="Brief description of this quiz"
                />

                <Input
                    label="Passing percentage"
                    value={passingPercentage}
                    onChange={setPassingPercentage}
                    type="text"
                />

                <div {...stylex.props(styles.section)}>
                    <p {...stylex.props(styles.sectionLabel)}>
                        Questions ({selectedIds.length} selected)
                    </p>
                    <p {...stylex.props(styles.hint)}>
                        Select questions and reorder them. Versions are pinned at creation time.
                    </p>
                    <div {...stylex.props(styles.questionList)}>
                        {availableQuestions.map((q) => {
                            const isSelected = selectedSet.has(q.id);
                            const selectedIndex = selectedIds.indexOf(q.id);
                            return (
                                <div
                                    key={q.id}
                                    {...stylex.props(styles.questionRow, isSelected && styles.questionRowSelected)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleQuestion(q.id)}
                                        {...stylex.props(styles.checkbox)}
                                        aria-label={`Select question: ${q.prompt}`}
                                    />
                                    <span {...stylex.props(styles.questionPrompt)}>{q.prompt}</span>
                                    <span {...stylex.props(styles.questionVersion)}>v{q.version}</span>
                                    {isSelected && (
                                        <div {...stylex.props(styles.reorderButtons)}>
                                            <button
                                                type="button"
                                                onClick={() => moveUp(selectedIndex)}
                                                {...stylex.props(styles.reorderBtn)}
                                                aria-label="Move up"
                                            >
                                                <ArrowUp size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveDown(selectedIndex)}
                                                {...stylex.props(styles.reorderBtn)}
                                                aria-label="Move down"
                                            >
                                                <ArrowDown size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}
