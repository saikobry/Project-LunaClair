import { useId } from 'react';
import type { Question } from '../../../domain/quiz/Question';

interface IdentificationQuestionProps {
    question: Question;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

/** Text entry UI for identification questions. */
export function IdentificationQuestion({ question, value, onChange, disabled }: IdentificationQuestionProps) {
    const inputId = useId();
    return (
        <div>
            <label htmlFor={inputId} style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
                {question.prompt}
            </label>
            <input
                id={inputId}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder="Type your answer…"
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    fontSize: 14,
                }}
            />
        </div>
    );
}
