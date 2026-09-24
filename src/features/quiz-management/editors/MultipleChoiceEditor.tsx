import * as stylex from '@stylexjs/stylex';
import { Plus } from 'lucide-react';
import type { MultipleChoicePayload } from '../../../domain/quiz/models/AnswerPayload';
import { useStableListKeys } from '../../../shared/hooks/useStableListKeys';
import { Button } from '../../../shared/ui/Button/Button';
import { ChoiceListRow } from './ChoiceListRow';
import { styles } from './choiceList.stylex';

interface MultipleChoiceEditorProps {
    value: MultipleChoicePayload;
    onChange: (payload: MultipleChoicePayload) => void;
}

/**
 * Single-correct choice editor: owns the scalar `correctIndex` selection
 * logic, index management, and the min-2 guard. Row presentation lives in
 * `ChoiceListRow` — this wrapper deliberately does NOT share a variant-prop
 * component with MultipleSelectEditor, because the data shapes diverge in
 * every handler.
 */
export function MultipleChoiceEditor({ value, onChange }: MultipleChoiceEditorProps) {
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
        const correctIndex = value.correctIndex >= updated.length ? 0 : value.correctIndex;
        onChange({ ...value, choices: updated, correctIndex });
    };

    const setCorrect = (index: number) => {
        onChange({ ...value, correctIndex: index });
    };

    return (
        <div {...stylex.props(styles.container)}>
            <p {...stylex.props(styles.hint)}>Select the green check button next to the correct answer.</p>
            {choices.map((choice, i) => (
                <ChoiceListRow
                    key={choiceKeys[i]}
                    index={i}
                    choice={choice}
                    isSelected={value.correctIndex === i}
                    shape="circle"
                    onToggle={() => setCorrect(i)}
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
