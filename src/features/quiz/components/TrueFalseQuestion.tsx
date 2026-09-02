import type { Question } from '../../../domain/quiz/models/Question';

interface TrueFalseQuestionProps {
    question: Question;
    value: boolean | null;
    onChange: (value: boolean) => void;
    disabled?: boolean;
}

/** True/False toggle UI. */
export function TrueFalseQuestion({ question, value, onChange, disabled }: TrueFalseQuestionProps) {
    return (
        <fieldset disabled={disabled} style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>{question.prompt}</legend>
            <label style={{ display: 'inline-block', marginRight: 16, cursor: disabled ? 'default' : 'pointer' }}>
                <input
                    type="radio"
                    name={`tf-${question.id}`}
                    checked={value === true}
                    onChange={() => onChange(true)}
                    style={{ marginRight: 6 }}
                />
                True
            </label>
            <label style={{ display: 'inline-block', cursor: disabled ? 'default' : 'pointer' }}>
                <input
                    type="radio"
                    name={`tf-${question.id}`}
                    checked={value === false}
                    onChange={() => onChange(false)}
                    style={{ marginRight: 6 }}
                />
                False
            </label>
        </fieldset>
    );
}
