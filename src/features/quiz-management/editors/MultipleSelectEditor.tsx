import * as stylex from '@stylexjs/stylex';
import { Plus, X } from 'lucide-react';
import type { MultipleSelectPayload } from '../../../domain/quiz/AnswerPayload';
import { useStableListKeys } from '../../../shared/hooks/useStableListKeys';
import { Button } from '../../../shared/ui/Button/Button';
import { CorrectAnswerIndicator } from '../../../shared/ui/CorrectAnswerIndicator/CorrectAnswerIndicator';
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
        padding: '4px 6px',
        borderRadius: 8,
        border: '1px solid transparent',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
    },
    choiceRowActive: {
        backgroundColor: 'var(--color-success-muted)',
        borderColor: 'transparent',
    },
    choiceInput: {
        flex: 1,
    },
    hint: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
});

interface MultipleSelectEditorProps {
    value: MultipleSelectPayload;
    onChange: (payload: MultipleSelectPayload) => void;
}

export function MultipleSelectEditor({ value, onChange }: MultipleSelectEditorProps) {
    const choices = value.choices.length > 0 ? value.choices : ['', ''];
    const choiceKeys = useStableListKeys(choices);

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
        // Single pass (no .filter().map() chain): drop the removed index and
        // shift any index above it down by one, preserving order.
        const correctIndices = value.correctIndices.reduce<number[]>((acc, i) => {
            if (i === index) return acc;
            acc.push(i > index ? i - 1 : i);
            return acc;
        }, []);
        onChange({ ...value, choices: updated, correctIndices });
    };

    const toggleCorrect = (index: number) => {
        const isCorrect = value.correctIndices.includes(index);
        const correctIndices = isCorrect
            ? value.correctIndices.filter((i) => i !== index)
            : [...value.correctIndices, index];
        onChange({ ...value, correctIndices });
    };

    const correctSet = new Set(value.correctIndices);

    return (
        <div {...stylex.props(styles.container)}>
            <p {...stylex.props(styles.hint)}>Check all correct answers.</p>
            {choices.map((choice, i) => {
                const isSelected = correctSet.has(i);
                return (
                    <div
                        key={choiceKeys[i]}
                        {...stylex.props(styles.choiceRow, isSelected && styles.choiceRowActive)}
                    >
                        <CorrectAnswerIndicator
                            isSelected={isSelected}
                            onToggle={() => toggleCorrect(i)}
                            ariaLabel={`Mark choice ${i + 1} as correct`}
                            shape="square"
                        />
                        <div {...stylex.props(styles.choiceInput)}>
                            <Input
                                label={`Choice ${i + 1}`}
                                labelHidden
                                value={choice}
                                onChange={(v) => updateChoice(i, v)}
                                placeholder={`Choice ${i + 1}`}
                            />
                        </div>
                        <Button
                            label={`Remove choice ${i + 1}`}
                            variant="ghost"
                            icon={<X size={14} />}
                            isIconOnly
                            isDisabled={choices.length <= 2}
                            onClick={() => removeChoice(i)}
                        />
                    </div>
                );
            })}
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
