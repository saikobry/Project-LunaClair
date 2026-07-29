import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { Question, QuestionDifficulty, QuestionStatus } from '../../../domain/quiz/Question';
import type { QuestionType } from '../../../domain/quiz/QuestionType';
import type { QuestionAnswerPayload } from '../../../domain/quiz/AnswerPayload';
import type { CreateQuestionInput, UpdateQuestionInput } from '../../../domain/quiz/QuestionRepository';
import { Dialog } from '../../../shared/ui/Dialog';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';
import { useToast } from '../../../app/providers/ToastContext';
import { getQuestionEditor, createDefaultPayload } from '../editors/QuestionEditorRegistry';

const styles = stylex.create({
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        marginTop: 16,
        maxHeight: 'calc(75vh - 100px)',
        overflowY: 'auto',
        paddingRight: 4,
        boxSizing: 'border-box',
    },
    row: {
        display: 'flex',
        gap: 12,
    },
    field: {
        flex: 1,
    },
    select: {
        width: '100%',
        padding: '8px 12px',
        fontSize: 14,
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        backgroundColor: 'var(--color-background-surface)',
        color: 'var(--color-text-primary)',
        boxSizing: 'border-box',
    },
    selectLabel: {
        display: 'block',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        marginBottom: 4,
    },
    editorSection: {
        paddingTop: 8,
        borderTop: '1px solid var(--color-border)',
    },
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        paddingTop: 8,
    },
});

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'multiple_select', label: 'Multiple Select' },
    { value: 'true_false', label: 'True / False' },
    { value: 'identification', label: 'Identification' },
    { value: 'fill_in_blank', label: 'Fill in the Blank' },
];

const DIFFICULTIES: { value: QuestionDifficulty; label: string }[] = [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
];

interface QuestionEditorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    materialId: string;
    /** If provided, dialog is in edit mode. */
    question?: Question | null;
    onSave: (input: CreateQuestionInput | UpdateQuestionInput, id?: string) => void;
}

/**
 * Check if a payload has meaningful user-entered data beyond defaults.
 */
function hasUserData(payload: QuestionAnswerPayload): boolean {
    if (!payload) return false;
    // Check if the payload has non-empty choices/options
    if ('options' in payload && Array.isArray(payload.options)) {
        return payload.options.some((o: { text?: string }) => o.text?.trim());
    }
    if ('correctAnswer' in payload && typeof payload.correctAnswer === 'string') {
        return payload.correctAnswer.trim().length > 0;
    }
    if ('blanks' in payload && Array.isArray(payload.blanks)) {
        return payload.blanks.some((b: string) => b.trim().length > 0);
    }
    return false;
}

export function QuestionEditorDialog({
    isOpen,
    onClose,
    materialId,
    question,
    onSave,
}: QuestionEditorDialogProps) {
    const { showToast } = useToast();
    const isEditing = !!question;
    const [type, setType] = useState<QuestionType>(question?.type ?? 'multiple_choice');
    const [prompt, setPrompt] = useState(question?.prompt ?? '');
    const [payload, setPayload] = useState<QuestionAnswerPayload>(
        question?.payload ?? createDefaultPayload('multiple_choice'),
    );
    const [difficulty, setDifficulty] = useState<QuestionDifficulty>(question?.difficulty ?? 'medium');
    const [points, setPoints] = useState(String(question?.points ?? 1));
    const [explanation, setExplanation] = useState(question?.explanation ?? '');
    const [tags, setTags] = useState(() => (question?.tags ?? []).join(', '));

    // Data safety state
    const [pendingTypeChange, setPendingTypeChange] = useState<QuestionType | null>(null);

    const handleTypeChangeRequest = useCallback((newType: QuestionType) => {
        if (hasUserData(payload)) {
            // Show confirmation before clearing payload
            setPendingTypeChange(newType);
        } else {
            setType(newType);
            setPayload(createDefaultPayload(newType));
        }
    }, [payload]);

    const handleConfirmTypeChange = useCallback(() => {
        if (pendingTypeChange) {
            setType(pendingTypeChange);
            setPayload(createDefaultPayload(pendingTypeChange));
            setPendingTypeChange(null);
        }
    }, [pendingTypeChange]);

    const handleCancelTypeChange = useCallback(() => {
        setPendingTypeChange(null);
    }, []);

    const handleSave = () => {
        const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
        const parsedPoints = Math.max(1, parseInt(points, 10) || 1);

        if (isEditing && question) {
            const input: UpdateQuestionInput = {
                prompt,
                payload,
                difficulty,
                points: parsedPoints,
                explanation: explanation || undefined,
                tags: parsedTags.length > 0 ? parsedTags : undefined,
            };
            onSave(input, question.id);
            showToast('Question updated', { intent: 'success' });
        } else {
            const input: CreateQuestionInput = {
                materialId,
                type,
                prompt,
                payload,
                difficulty,
                points: parsedPoints,
                explanation: explanation || undefined,
                tags: parsedTags.length > 0 ? parsedTags : undefined,
                status: 'draft' as QuestionStatus,
            };
            onSave(input);
            showToast('Question created successfully', { intent: 'success' });
        }
        onClose();
    };

    const EditorComponent = getQuestionEditor(type);

    return (
        <>
            <Dialog
                isOpen={isOpen}
                onClose={onClose}
                title={isEditing ? 'Edit Question' : 'New Question'}
                width={600}
                maxHeight="85vh"
                purpose="form"
            >
                <div {...stylex.props(styles.form)}>
                    {!isEditing && (
                        <div>
                            <label {...stylex.props(styles.selectLabel)}>Question type</label>
                            <select
                                value={type}
                                onChange={(e) => handleTypeChangeRequest(e.target.value as QuestionType)}
                                {...stylex.props(styles.select)}
                            >
                                {QUESTION_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <Input
                        label="Prompt"
                        value={prompt}
                        onChange={setPrompt}
                        placeholder="Enter the question prompt"
                        required
                    />

                    <div {...stylex.props(styles.editorSection)}>
                        <EditorComponent
                            value={payload as never}
                            onChange={setPayload as never}
                        />
                    </div>

                    <div {...stylex.props(styles.row)}>
                        <div {...stylex.props(styles.field)}>
                            <label {...stylex.props(styles.selectLabel)}>Difficulty</label>
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
                                {...stylex.props(styles.select)}
                            >
                                {DIFFICULTIES.map((d) => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </div>
                        <div {...stylex.props(styles.field)}>
                            <Input
                                label="Points"
                                value={points}
                                onChange={setPoints}
                                type="text"
                            />
                        </div>
                    </div>

                    <Input
                        label="Explanation (optional)"
                        value={explanation}
                        onChange={setExplanation}
                        placeholder="Shown to learners after answering"
                    />

                    <Input
                        label="Tags (comma-separated)"
                        value={tags}
                        onChange={setTags}
                        placeholder="e.g. skin, layers, anatomy"
                    />

                    <div {...stylex.props(styles.actions)}>
                        <Button label="Cancel" variant="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            label={isEditing ? 'Save changes' : 'Create question'}
                            variant="primary"
                            isDisabled={!prompt.trim()}
                            onClick={handleSave}
                        >
                            {isEditing ? 'Save Changes' : 'Create Question'}
                        </Button>
                    </div>
                </div>
            </Dialog>

            {/* Data safety confirmation dialog */}
            <ConfirmationDialog
                isOpen={pendingTypeChange !== null}
                title="Change Question Type?"
                message="Changing the question type will reset the current answer options. Any choices or answers you have entered will be lost. Continue?"
                confirmLabel="Change Type"
                intent="warning"
                onConfirm={handleConfirmTypeChange}
                onCancel={handleCancelTypeChange}
            />
        </>
    );
}
