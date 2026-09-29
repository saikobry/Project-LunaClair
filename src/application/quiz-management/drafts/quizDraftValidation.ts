import type { QuizDraft, QuestionDraft } from './QuizDraft';
import type { QuestionAnswerPayload } from '../../../domain/quiz/models/AnswerPayload';
import { validateQuestionPayload } from '../../../domain/quiz/validation/questionPayloadValidation';

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

    // Two rules on one card, two jobs, and only one owner each.
    //
    // `validatePayload` above is this module's own: it is the *authoring* voice. It names the field
    // to fix, keeps to one message per field, and only ever looks at `payload.type` — the shape the
    // canvas card is actually rendered from.
    //
    // `validateQuestionPayload` is the *structural* owner (domain/quiz/validation), the same rule the
    // package validator, the Question Bank and the generator run, and its wording is a frozen
    // contract mirrored by the Worker. It judges `payload` against a declared type and reports every
    // defect it finds. So it is called, never restated — but only for a card the authoring rules
    // accepted, which is what keeps the two from double-reporting one defect in two vocabularies.
    // Two facts have no authoring rule at all, and therefore no other way to be caught here: a
    // `payload.type` that disagrees with the card's declared `type` (the UI lists and labels the card
    // by the declared type while `questionToCards` dispatches on `payload.type`, so a mismatch
    // studies in a shape the declared type does not predict), and an `acceptedAlternatives` that is
    // not an array of strings.
    //
    // A card the authoring rules already refused is not judged again here. That is not a weaker
    // gate: such a card is refused either way and the structural findings surface on top of the
    // authoring ones as soon as the authoring rules are satisfied. What it costs is a message this
    // save does not show, on a card whose fixable field is the one the author is already reading.
    const authoringErrors = validatePayload(item.payload);
    errors.push(...authoringErrors);
    if (authoringErrors.length === 0) {
        errors.push(...validateQuestionPayload(item.type, item.payload));
    }
    return errors;
}

/**
 * Validates a quiz draft against authoring rules.
 *
 * Returns `null` when the draft is valid, otherwise a structured error map
 * (top-level `title` error plus per-card item errors keyed by `tempId`).
 *
 * This is a validating write boundary for the quiz canvas, and it is **not** a
 * second copy of the payload rule: a card the authoring rules accept is handed
 * to `domain/quiz/validation/questionPayloadValidation` — the single owner —
 * so the canvas cannot save a payload the Question Bank or the package
 * validator would refuse. See `validateItem` for why the two are combined in
 * that order rather than merged.
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
