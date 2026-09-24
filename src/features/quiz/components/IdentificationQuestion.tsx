import type { Question } from '../../../domain/quiz/models/Question';
import { Input } from '../../../shared/ui/Input/Input';

interface IdentificationQuestionProps {
    question: Question;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

/**
 * Text entry UI for identification questions.
 *
 * Uses the shared `<Input>` rather than a raw `<input>`: the question prompt is
 * the field's label, so the visual label and the accessible name are the same
 * element and the old hand-wired `useId`/`htmlFor` pair is gone. The previous
 * inline `border: 1px solid #ccc` literal was an unthemed escape hatch; the
 * primitive supplies the themed field chrome instead.
 */
export function IdentificationQuestion({ question, value, onChange, disabled }: IdentificationQuestionProps) {
    return (
        <Input
            label={question.prompt}
            value={value}
            onChange={onChange}
            placeholder="Type your answer…"
            disabled={disabled}
        />
    );
}
