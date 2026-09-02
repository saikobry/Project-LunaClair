import type { Question } from '../../../domain/quiz/models/Question';
import type { MultipleChoicePayload } from '../../../domain/quiz/models/AnswerPayload';

interface MultipleChoiceQuestionProps {
    question: Question;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

/** Single-select radio UI for multiple choice questions. */
export function MultipleChoiceQuestion({ question, value, onChange, disabled }: MultipleChoiceQuestionProps) {
    const payload = question.payload as MultipleChoicePayload;

    return (
        <fieldset disabled={disabled} style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>{question.prompt}</legend>
            {payload.choices.map((choice, index) => (
                <label key={choice} style={{ display: 'block', marginBottom: 6, cursor: disabled ? 'default' : 'pointer' }}>
                    <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={String(index)}
                        checked={value === String(index)}
                        onChange={() => onChange(String(index))}
                        style={{ marginRight: 8 }}
                    />
                    {choice}
                </label>
            ))}
        </fieldset>
    );
}
