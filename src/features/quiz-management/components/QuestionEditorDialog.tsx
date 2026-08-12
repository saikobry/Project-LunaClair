import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { Question, QuestionDifficulty, QuestionStatus } from '../../../domain/quiz/Question';
import type { QuestionType } from '../../../domain/quiz/QuestionType';
import type { QuestionAnswerPayload } from '../../../domain/quiz/AnswerPayload';
import type { CreateQuestionInput, UpdateQuestionInput } from '../../../domain/quiz/QuestionRepository';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Button } from '../../../shared/ui/Button/Button';
import { Input } from '../../../shared/ui/Input/Input';
import { Selector } from '../../../shared/ui/Selector/Selector';
import { TextArea } from '../../../shared/ui/TextArea/TextArea';
import { TagInput } from '../../../shared/ui/TagInput/TagInput';
import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';
import { useToast } from '../../../app/providers/ToastContext';
import { getQuestionEditor, createDefaultPayload } from '../editors/QuestionEditorRegistry';
import { normalizeTags } from '../../../domain/quiz/tags';

const styles = stylex.create({
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    row: {
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
    },
    field: {
        flex: 1,
        minWidth: 140,
    },
    editorSection: {
        paddingTop: 8,
        borderTop: '1px solid var(--color-border)',
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
    question?: Question | null;
    onSave: (input: CreateQuestionInput | UpdateQuestionInput, id?: string) => void;
}

function hasUserData(payload: QuestionAnswerPayload): boolean {
    if (!payload) return false;
    if ('choices' in payload && Array.isArray(payload.choices)) {
        return payload.choices.some((c: string) => c?.trim());
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
    const [tags, setTags] = useState<string[]>(question?.tags ?? []);

    const [pendingTypeChange, setPendingTypeChange] = useState<QuestionType | null>(null);

    const handleTypeChangeRequest = useCallback((newType: QuestionType) => {
        if (hasUserData(payload)) {
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
        const parsedTags = normalizeTags(tags);
        const parsedPoints = Math.max(1, parseInt(points, 10) || 1);

        if (isEditing && question) {
            const input: UpdateQuestionInput = {
                prompt,
                payload,
                difficulty,
                points: parsedPoints,
                explanation: explanation || undefined,
                tags: parsedTags,
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
                tags: parsedTags,
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
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
                }
            >
                <div {...stylex.props(styles.form)}>
                    {!isEditing && (
                        <Selector
                            label="Question type"
                            options={QUESTION_TYPES}
                            value={type}
                            onChange={(v) => handleTypeChangeRequest(v as QuestionType)}
                        />
                    )}

                    <TextArea
                        label="Prompt"
                        value={prompt}
                        onChange={setPrompt}
                        placeholder="Enter the question prompt"
                        required
                        rows={2}
                    />

                    <div {...stylex.props(styles.editorSection)}>
                        <EditorComponent
                            value={payload as never}
                            onChange={setPayload as never}
                        />
                    </div>

                    <div {...stylex.props(styles.row)}>
                        <div {...stylex.props(styles.field)}>
                            <Selector
                                label="Difficulty"
                                options={DIFFICULTIES}
                                value={difficulty}
                                onChange={(v) => setDifficulty(v as QuestionDifficulty)}
                            />
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

                    <TextArea
                        label="Explanation (optional)"
                        value={explanation}
                        onChange={setExplanation}
                        placeholder="Shown to learners after answering"
                        rows={3}
                    />

                    <TagInput
                        label="Tags"
                        tags={tags}
                        onChange={setTags}
                        placeholder="Type a tag and press Enter…"
                    />
                </div>
            </Dialog>

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
