import { useMemo } from 'react';
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

    /** Template segments keyed by content, never by index (list is static per question). */
    const parts = useMemo(() => {
        const seen = new Map<string, number>();
        return payload.template.split('___').map((text) => {
            const occurrence = seen.get(text) ?? 0;
            seen.set(text, occurrence + 1);
            return { text, key: `${text}:${occurrence}` };
        });
    }, [payload.template]);

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
                    <span key={part.key}>
                        {part.text}
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
