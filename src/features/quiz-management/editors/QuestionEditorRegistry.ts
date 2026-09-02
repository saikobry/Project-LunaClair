import type { ComponentType } from 'react';
import type { QuestionType } from '../../../domain/quiz/models/QuestionType';
import type { QuestionAnswerPayload } from '../../../domain/quiz/models/AnswerPayload';
import { MultipleChoiceEditor } from './MultipleChoiceEditor';
import { MultipleSelectEditor } from './MultipleSelectEditor';
import { TrueFalseEditor } from './TrueFalseEditor';
import { IdentificationEditor } from './IdentificationEditor';
import { FillBlankEditor } from './FillBlankEditor';

export interface QuestionEditorProps {
    value: QuestionAnswerPayload;
    onChange: (payload: QuestionAnswerPayload) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorComponent = ComponentType<any>;

const registry: Record<QuestionType, EditorComponent> = {
    multiple_choice: MultipleChoiceEditor,
    multiple_select: MultipleSelectEditor,
    true_false: TrueFalseEditor,
    identification: IdentificationEditor,
    fill_in_blank: FillBlankEditor,
};

/** Returns the editor component registered for the given question type. */
export function getQuestionEditor(type: QuestionType): EditorComponent {
    return registry[type];
}

/** Authoring labels for each question type (dropdowns and selectors). */
export const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'multiple_select', label: 'Multiple Select' },
    { value: 'true_false', label: 'True / False' },
    { value: 'identification', label: 'Identification' },
    { value: 'fill_in_blank', label: 'Fill in the Blank' },
];

/** Default payload factories for creating new questions by type. */
export function createDefaultPayload(type: QuestionType): QuestionAnswerPayload {
    switch (type) {
        case 'multiple_choice':
            return { type: 'multiple_choice', choices: ['', ''], correctIndex: 0 };
        case 'multiple_select':
            return { type: 'multiple_select', choices: ['', ''], correctIndices: [] };
        case 'true_false':
            return { type: 'true_false', correctAnswer: true };
        case 'identification':
            return { type: 'identification', correctAnswer: '', acceptedAlternatives: [] };
        case 'fill_in_blank':
            return { type: 'fill_in_blank', template: '', blanks: [] };
    }
}
