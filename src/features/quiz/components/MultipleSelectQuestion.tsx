import type { Question } from '../../../domain/quiz/models/Question';
import type { MultipleSelectPayload } from '../../../domain/quiz/models/AnswerPayload';

interface MultipleSelectQuestionProps {
    question: Question;
    value: string[];
    onChange: (value: string[]) => void;
    disabled?: boolean;
}

/** Multi-select checkbox UI for multiple select questions. */
export function MultipleSelectQuestion({ question, value, onChange, disabled }: MultipleSelectQuestionProps) {
    const payload = question.payload as MultipleSelectPayload;
    const selected = new Set(value);

    const toggle = (index: number) => {
        const key = String(index);
        if (value.includes(key)) {
            onChange(value.filter((v) => v !== key));
        } else {
            onChange([...value, key]);
        }
    };

    return (
        <fieldset disabled={disabled} style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>{question.prompt}</legend>
            {payload.choices.map((choice, index) => (
                <label key={choice} style={{ display: 'block', marginBottom: 6, cursor: disabled ? 'default' : 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={selected.has(String(index))}
                        onChange={() => toggle(index)}
                        style={{ marginRight: 8 }}
                    />
                    {choice}
                </label>
            ))}
        </fieldset>
    );
}
