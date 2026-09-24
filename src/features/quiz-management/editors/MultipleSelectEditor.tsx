import * as stylex from '@stylexjs/stylex';
import { Plus } from 'lucide-react';
import type { MultipleSelectPayload } from '../../../domain/quiz/models/AnswerPayload';
import { useStableListKeys } from '../../../shared/hooks/useStableListKeys';
import { Button } from '../../../shared/ui/Button/Button';
import { ChoiceListRow } from './ChoiceListRow';
import { styles } from './choiceList.stylex';

interface MultipleSelectEditorProps {
    value: MultipleSelectPayload;
    onChange: (payload: MultipleSelectPayload) => void;
}

/**
 * Multi-correct choice editor: owns the `correctIndices` set logic —
 * membership toggle plus the index-shift-on-remove reduce — the min-2 guard,
 * and hint copy. Row presentation lives in `ChoiceListRow`; the divergence
 * from MultipleChoiceEditor is data shape, so the two stay separate wrappers
 * rather than one `selection` variant-prop component.
 */
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
            {choices.map((choice, i) => (
                <ChoiceListRow
                    key={choiceKeys[i]}
                    index={i}
                    choice={choice}
                    isSelected={correctSet.has(i)}
                    shape="square"
                    onToggle={() => toggleCorrect(i)}
                    onChange={(text) => updateChoice(i, text)}
                    onRemove={() => removeChoice(i)}
                    isRemoveDisabled={choices.length <= 2}
                />
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
