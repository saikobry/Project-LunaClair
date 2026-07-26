import * as stylex from '@stylexjs/stylex';
import { Plus, Trash2 } from 'lucide-react';
import type { MultipleSelectPayload } from '../../../domain/quiz/AnswerPayload';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    choiceRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    checkbox: {
        width: 16,
        height: 16,
        accentColor: '#6366f1',
        cursor: 'pointer',
        flexShrink: 0,
    },
    choiceInput: {
        flex: 1,
    },
    hint: {
        fontSize: 12,
        color: '#6b6375',
        margin: 0,
    },
});

interface MultipleSelectEditorProps {
    value: MultipleSelectPayload;
    onChange: (payload: MultipleSelectPayload) => void;
}

export function MultipleSelectEditor({ value, onChange }: MultipleSelectEditorProps) {
    const choices = value.choices.length > 0 ? value.choices : ['', ''];

    const updateChoice = (index: number, text: string) => {
        const updated = [...choices];
        updated[index] = text;
        onChange({ ...value, choices: updated });
    };

    const addChoice = () => {
        onChange({ ...value, choices: [...choices, ''] });
    };

    const removeChoice = (index: number) => {
        if (choices.length <= 2) return;
        const updated = choices.filter((_, i) => i !== index);
        const correctIndices = value.correctIndices
            .filter((i) => i !== index)
            .map((i) => (i > index ? i - 1 : i));
        onChange({ ...value, choices: updated, correctIndices });
    };

    const toggleCorrect = (index: number) => {
        const isCorrect = value.correctIndices.includes(index);
        const correctIndices = isCorrect
            ? value.correctIndices.filter((i) => i !== index)
            : [...value.correctIndices, index];
        onChange({ ...value, correctIndices });
    };

    return (
        <div {...stylex.props(styles.container)}>
            <p {...stylex.props(styles.hint)}>Check all correct answers.</p>
            {choices.map((choice, i) => (
                <div key={i} {...stylex.props(styles.choiceRow)}>
                    <input
                        type="checkbox"
                        checked={value.correctIndices.includes(i)}
                        onChange={() => toggleCorrect(i)}
                        {...stylex.props(styles.checkbox)}
                        aria-label={`Mark choice ${i + 1} as correct`}
                    />
                    <div {...stylex.props(styles.choiceInput)}>
                        <Input
                            label={`Choice ${i + 1}`}
                            value={choice}
                            onChange={(v) => updateChoice(i, v)}
                            placeholder={`Choice ${i + 1}`}
                        />
                    </div>
                    <Button
                        label={`Remove choice ${i + 1}`}
                        variant="danger"
                        icon={<Trash2 size={14} />}
                        isIconOnly
                        isDisabled={choices.length <= 2}
                        onClick={() => removeChoice(i)}
                    />
                </div>
            ))}
            <Button
                label="Add choice"
                variant="secondary"
                icon={<Plus size={14} />}
                onClick={addChoice}
            >
                Add Choice
            </Button>
        </div>
    );
}
