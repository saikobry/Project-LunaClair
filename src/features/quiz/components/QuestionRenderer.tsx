import type { Question } from '../../../domain/quiz/Question';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { MultipleSelectQuestion } from './MultipleSelectQuestion';
import { TrueFalseQuestion } from './TrueFalseQuestion';
import { IdentificationQuestion } from './IdentificationQuestion';
import { FillBlankQuestion } from './FillBlankQuestion';

export type AnswerValue = string | string[] | boolean;

interface QuestionRendererProps {
    question: Question;
    value: AnswerValue;
    onChange: (value: AnswerValue) => void;
    disabled?: boolean;
}

/**
 * Central renderer that switches on question.type to render
 * the appropriate question UI component.
 */
export function QuestionRenderer({ question, value, onChange, disabled }: QuestionRendererProps) {
    switch (question.type) {
        case 'multiple_choice':
            return (
                <MultipleChoiceQuestion
                    question={question}
                    value={typeof value === 'string' ? value : ''}
                    onChange={onChange}
                    disabled={disabled}
                />
            );
        case 'multiple_select':
            return (
                <MultipleSelectQuestion
                    question={question}
                    value={Array.isArray(value) ? value : []}
                    onChange={onChange}
                    disabled={disabled}
                />
            );
        case 'true_false':
            return (
                <TrueFalseQuestion
                    question={question}
                    value={typeof value === 'boolean' ? value : null}
                    onChange={onChange}
                    disabled={disabled}
                />
            );
        case 'identification':
            return (
                <IdentificationQuestion
                    question={question}
                    value={typeof value === 'string' ? value : ''}
                    onChange={onChange}
                    disabled={disabled}
                />
            );
        case 'fill_in_blank':
            return (
                <FillBlankQuestion
                    question={question}
                    value={Array.isArray(value) ? value : []}
                    onChange={onChange}
                    disabled={disabled}
                />
            );
    }
}
