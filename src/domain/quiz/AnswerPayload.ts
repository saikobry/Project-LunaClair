import type { QuestionType } from './QuestionType';

export interface MultipleChoicePayload {
    type: 'multiple_choice';
    choices: string[];
    correctIndex: number;
}

export interface MultipleSelectPayload {
    type: 'multiple_select';
    choices: string[];
    correctIndices: number[];
}

export interface TrueFalsePayload {
    type: 'true_false';
    correctAnswer: boolean;
}

export interface IdentificationPayload {
    type: 'identification';
    correctAnswer: string;
    /** Optional list of accepted alternative answers (case-insensitive). */
    acceptedAlternatives?: string[];
}

export interface FillBlankPayload {
    type: 'fill_in_blank';
    /** Template string with `___` placeholders, e.g. "The ___ is the largest organ." */
    template: string;
    /** Ordered correct answers for each blank. */
    blanks: string[];
}

export type QuestionAnswerPayload =
    | MultipleChoicePayload
    | MultipleSelectPayload
    | TrueFalsePayload
    | IdentificationPayload
    | FillBlankPayload;

/** Extracts the payload type for a given QuestionType discriminant. */
export type PayloadForType<T extends QuestionType> = Extract<QuestionAnswerPayload, { type: T }>;
