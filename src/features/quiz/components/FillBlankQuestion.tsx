import type { Question } from '../../../domain/quiz/Question';
import type { FillBlankPayload } from '../../../domain/quiz/AnswerPayload';

interface FillBlankQuestionProps {
    question: Question;
    value: string[];
    onChange: (value: string[]) => void;
    disabled?: boolean;
}

/** Template with inline text inputs for fill-in-the-blank questions. */
export function FillBlankQuestion({ question, value, onChange, disabled }: FillBlankQuestionProps) {
    const payload = question.payload as FillBlankPayload;
    const parts = payload.template.split('___');

    const handleBlankChange = (index: number, text: string) => {
        const next = [...value];
        next[index] = text;
        onChange(next);
    };

    return (
        <div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>{question.prompt}</p>
            <p style={{ lineHeight: 2 }}>
                {parts.map((part, i) => (
                    <span key={i}>
                        {part}
                        {i < parts.length - 1 && (
                            <input
                                type="text"
                                value={value[i] ?? ''}
                                onChange={(e) => handleBlankChange(i, e.target.value)}
                                disabled={disabled}
                                placeholder={`blank ${i + 1}`}
                                style={{
                                    width: 120,
                                    padding: '4px 8px',
                                    margin: '0 4px',
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                    fontSize: 14,
                                }}
                            />
                        )}
                    </span>
                ))}
            </p>
        </div>
    );
}
