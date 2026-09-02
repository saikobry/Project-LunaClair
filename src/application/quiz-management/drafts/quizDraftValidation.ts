import type { QuizDraft, QuestionDraft } from './QuizDraft';
import type { QuestionAnswerPayload } from '../../../domain/quiz/models/AnswerPayload';

/**
 * Structured validation errors for a `QuizDraft`.
 *
 * `items` is keyed by card `tempId` so the canvas can focus and annotate
 * the first invalid card with inline messages.
 */
export interface QuizDraftErrors {
    title?: string;
    items: Record<string, string[]>;
}

function blankCount(template: string): number {
    return (template.match(/___/g) ?? []).length;
}

function validatePayload(payload: QuestionAnswerPayload): string[] {
    const errors: string[] = [];
    switch (payload.type) {
        case 'multiple_choice': {
            if (payload.choices.length < 2) {
                errors.push('Add at least two choices.');
            } else if (payload.choices.some((choice) => !choice.trim())) {
                errors.push('Every choice needs text.');
            }
            if (payload.correctIndex < 0 || payload.correctIndex >= payload.choices.length) {
                errors.push('Select the correct answer.');
            }
            return errors;
        }
        case 'multiple_select': {
            if (payload.choices.length < 2) {
                errors.push('Add at least two choices.');
            } else if (payload.choices.some((choice) => !choice.trim())) {
                errors.push('Every choice needs text.');
            }
            if (payload.correctIndices.length === 0) {
                errors.push('Mark at least one choice as correct.');
            } else if (payload.correctIndices.some((i) => i < 0 || i >= payload.choices.length)) {
                errors.push('One of the correct answers is no longer a valid choice.');
            }
            return errors;
        }
        case 'true_false':
            return errors;
        case 'identification':
            if (!payload.correctAnswer.trim()) {
                errors.push('Enter the correct answer.');
            }
            return errors;
        case 'fill_in_blank': {
            const count = blankCount(payload.template);
            if (count === 0) {
                errors.push('Use ___ (three underscores) to mark at least one blank.');
            } else if (payload.blanks.length !== count) {
                errors.push('Every blank needs an answer.');
            } else if (payload.blanks.some((answer) => !answer.trim())) {
                errors.push('Every blank needs an answer.');
            }
            return errors;
        }
    }
}

function validateItem(item: QuestionDraft): string[] {
    const errors: string[] = [];
    if (!item.prompt.trim()) {
        errors.push('Question prompt is required.');
    }
    if (Number.isNaN(item.points) || item.points < 1) {
        errors.push('Points must be at least 1.');
    }
    errors.push(...validatePayload(item.payload));
    return errors;
}

/**
 * Validates a quiz draft against authoring rules.
 *
 * Returns `null` when the draft is valid, otherwise a structured error map
 * (top-level `title` error plus per-card item errors keyed by `tempId`).
 */
export function validateQuizDraft(draft: QuizDraft): QuizDraftErrors | null {
    const errors: QuizDraftErrors = { items: {} };

    if (!draft.title.trim()) {
        errors.title = 'Quiz title is required.';
    }
    if (draft.items.length === 0) {
        errors.title = errors.title ?? 'Add at least one question to the quiz.';
    }

    for (const item of draft.items) {
        const itemErrors = validateItem(item);
        if (itemErrors.length > 0) {
            errors.items[item.tempId] = itemErrors;
        }
    }

    const hasErrors = Boolean(errors.title) || Object.keys(errors.items).length > 0;
    return hasErrors ? errors : null;
}
