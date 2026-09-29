import type { GeneratedQuestionDraft } from '../models/generator.types';
import type { QuestionType } from '../../quiz/models/QuestionType';
import type { QuestionDifficulty } from '../../quiz/models/Question';
import type { QuestionAnswerPayload } from '../../quiz/models/AnswerPayload';
import { VALID_QUESTION_TYPES } from '../../quiz/models/questionMetadata';

const VALID_DIFFICULTIES: Set<QuestionDifficulty> = new Set(['easy', 'medium', 'hard']);

/**
 * Number of `___` blank markers in a `fill_in_blank` template.
 *
 * Mirrors the authoring path's rule (`quizDraftValidation`), so a generated draft and a hand-authored
 * one are held to the same blank-marker contract.
 */
function blankCount(template: string): number {
    return (template.match(/___/g) ?? []).length;
}

/**
 * Validates a single question draft object against domain business rules.
 */
export function validateQuestionDraft(
  item: unknown,
): { success: true; data: GeneratedQuestionDraft } | { success: false; error: string } {
  if (!item || typeof item !== 'object') {
    return { success: false, error: 'Question must be an object' };
  }

  const obj = item as Record<string, unknown>;

  if (typeof obj.prompt !== 'string' || !obj.prompt.trim()) {
    return { success: false, error: 'Question prompt must be a non-empty string' };
  }

  const payloadObj = (obj.payload && typeof obj.payload === 'object' ? obj.payload : obj) as Record<
    string,
    unknown
  >;

  // The model sporadically loses the leading token of `true_false`, emitting `_false` (observed
  // across runs). The payload carries its own `type`, so when the top-level one is unusable but the
  // payload's names a real type, adopt it: the answer shape is the authoritative statement of what
  // kind of question this is. Strictly a fallback — a valid top-level type always wins.
  const declaredType =
    typeof obj.type === 'string' && VALID_QUESTION_TYPES.has(obj.type as QuestionType)
      ? (obj.type as QuestionType)
      : typeof payloadObj.type === 'string' && VALID_QUESTION_TYPES.has(payloadObj.type as QuestionType)
        ? (payloadObj.type as QuestionType)
        : undefined;

  if (!declaredType) {
    return { success: false, error: `Invalid question type: ${String(obj.type)}` };
  }

  const type = declaredType;
  const difficulty: QuestionDifficulty =
    typeof obj.difficulty === 'string' && VALID_DIFFICULTIES.has(obj.difficulty as QuestionDifficulty)
      ? (obj.difficulty as QuestionDifficulty)
      : 'medium';

  const points = typeof obj.points === 'number' && obj.points > 0 ? obj.points : 1;
  const explanation = typeof obj.explanation === 'string' ? obj.explanation.trim() : undefined;
  const sourceSection = typeof obj.sourceSection === 'string' ? obj.sourceSection.trim() : undefined;
  const tags = Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : [];

  let validatedPayload: QuestionAnswerPayload;

  switch (type) {
    case 'multiple_choice': {
      if (!Array.isArray(payloadObj.choices) || payloadObj.choices.length < 2) {
        return { success: false, error: 'multiple_choice requires at least 2 choices' };
      }
      const choices = payloadObj.choices.flatMap((c) => {
        const trimmed = String(c).trim();
        return trimmed ? [trimmed] : [];
      });
      if (choices.length < 2) {
        return { success: false, error: 'multiple_choice requires at least 2 non-empty choices' };
      }

      // Recover the index, or recover it from a stated answer string.
      let correctIndex = typeof payloadObj.correctIndex === 'number' ? payloadObj.correctIndex : -1;
      if (correctIndex < 0 || correctIndex >= choices.length) {
        correctIndex =
          typeof payloadObj.correctAnswer === 'string'
            ? choices.indexOf(payloadObj.correctAnswer.trim())
            : -1;
      }

      // No answer is recoverable, and inventing one (previously index 0) would assert a fact about
      // the material the model never supplied — a draft that looks authoritative and is wrong. The
      // item is reported instead, so the caller can say how many were dropped.
      if (correctIndex < 0 || correctIndex >= choices.length) {
        return { success: false, error: 'multiple_choice has no determinable correct answer' };
      }

      validatedPayload = {
        type: 'multiple_choice',
        choices,
        correctIndex,
      };
      break;
    }

    case 'multiple_select': {
      if (!Array.isArray(payloadObj.choices) || payloadObj.choices.length < 2) {
        return { success: false, error: 'multiple_select requires at least 2 choices' };
      }
      const choices = payloadObj.choices.flatMap((c) => {
        const trimmed = String(c).trim();
        return trimmed ? [trimmed] : [];
      });
      const correctIndices = Array.isArray(payloadObj.correctIndices)
        ? payloadObj.correctIndices.filter(
            (idx): idx is number => typeof idx === 'number' && idx >= 0 && idx < choices.length,
          )
        : [];

      // Same rule as multiple_choice: an unanswered question is rejected, not defaulted to the first
      // choice, which would quietly mark a distractor as correct.
      if (correctIndices.length === 0) {
        return { success: false, error: 'multiple_select has no determinable correct answers' };
      }

      validatedPayload = {
        type: 'multiple_select',
        choices,
        correctIndices,
      };
      break;
    }

    case 'true_false': {
      const correctAnswer =
        typeof payloadObj.correctAnswer === 'boolean' ? payloadObj.correctAnswer : true;

      validatedPayload = {
        type: 'true_false',
        correctAnswer,
      };
      break;
    }

    case 'identification': {
      const correctAnswer =
        typeof payloadObj.correctAnswer === 'string' ? payloadObj.correctAnswer.trim() : '';
      if (!correctAnswer) {
        return { success: false, error: 'identification requires a non-empty correctAnswer' };
      }

      const acceptedAlternatives = Array.isArray(payloadObj.acceptedAlternatives)
        ? payloadObj.acceptedAlternatives.flatMap((a) => {
            const trimmed = String(a).trim();
            return trimmed ? [trimmed] : [];
          })
        : undefined;

      validatedPayload = {
        type: 'identification',
        correctAnswer,
        acceptedAlternatives,
      };
      break;
    }

    case 'fill_in_blank': {
      const template = typeof payloadObj.template === 'string' ? payloadObj.template.trim() : '';

      // The `___` marker IS the question. A template without one (empty, or already resolved) yields a
      // card whose front is `prompt + template` with nothing to fill in, and a marker/answer mismatch
      // yields a blank that was never supplied a fact. Both are rejected rather than repaired — the
      // generator never invents data, it reports the item so the caller can name the dropped count.
      const markers = blankCount(template);
      if (markers === 0) {
        return { success: false, error: 'fill_in_blank requires template with blank placeholder' };
      }

      const rawBlanks = Array.isArray(payloadObj.blanks) ? payloadObj.blanks : [];
      const blanks = rawBlanks.flatMap((b) => {
        const trimmed = String(b).trim();
        return trimmed ? [trimmed] : [];
      });

      if (blanks.length === 0) {
        return { success: false, error: 'fill_in_blank requires at least 1 blank answer' };
      }

      // Parity is measured against the RAW input, not the filtered `blanks`: a whitespace-only entry
      // is dropped above, so comparing markers to the filtered length would blame a count mismatch for
      // what is really an unanswered blank. Each defect then carries its own attributable message.
      if (blanks.length !== rawBlanks.length) {
        return { success: false, error: 'fill_in_blank requires a non-empty answer for every blank' };
      }

      if (blanks.length !== markers) {
        return {
          success: false,
          error: `fill_in_blank requires one answer per ___ placeholder (${markers} in template, ${blanks.length} supplied)`,
        };
      }

      validatedPayload = {
        type: 'fill_in_blank',
        template,
        blanks,
      };
      break;
    }
  }

  return {
    success: true,
    data: {
      type,
      prompt: obj.prompt.trim(),
      payload: validatedPayload,
      difficulty,
      points,
      explanation,
      tags,
      sourceSection,
    },
  };
}

/**
 * A draft the model produced that failed domain validation.
 *
 * Kept rather than discarded so the caller can report *what* was dropped instead of silently
 * returning fewer items than were requested.
 */
export interface RejectedDraft {
  /** 0-based position in the model's array, so the message can point at the offending item. */
  index: number;
  error: string;
}

/**
 * The outcome of validating a model's array: the drafts that survived, plus the ones that did not.
 *
 * A batch is **salvageable, not all-or-nothing**. Models write these arrays freehand, so a single
 * slip — a mistyped `true_false` as `_false`, a blank required field — used to discard every valid
 * sibling and surface a raw validator string. The review step is built to handle a partial batch
 * (it pre-selects only the drafts that validate), so failing the whole array here contradicted it.
 */
export interface DraftBatch<T> {
  drafts: T[];
  rejected: RejectedDraft[];
}

/**
 * Validates an array of question drafts from AI output.
 *
 * Fails only when there is nothing usable at all — a non-array, an empty array, or every item
 * invalid — because "the model produced nothing we can open a review step with" is a real failure,
 * whereas "the model produced nine good questions and one typo" is not.
 *
 * This is the **only** draft-array validator: there is no flashcard array. A card is a
 * projection of a typed question, so a generated card arrives here as a `fill_in_blank` item
 * and is held to the same `___`/blank parity as any other cloze.
 */
export function validateQuestionsDraftArray(
  data: unknown,
): { success: true; data: DraftBatch<GeneratedQuestionDraft> } | { success: false; error: string } {
  if (!Array.isArray(data)) {
    return { success: false, error: 'Expected an array of questions' };
  }

  if (data.length === 0) {
    return { success: false, error: 'AI generated an empty array of questions' };
  }

  const drafts: GeneratedQuestionDraft[] = [];
  const rejected: RejectedDraft[] = [];

  for (let i = 0; i < data.length; i++) {
    const res = validateQuestionDraft(data[i]);
    if (res.success) {
      drafts.push(res.data);
    } else {
      rejected.push({ index: i, error: res.error });
    }
  }

  if (drafts.length === 0) {
    return {
      success: false,
      error: `No usable questions in the response (first problem: item ${rejected[0].index + 1} — ${rejected[0].error})`,
    };
  }

  return {
    success: true,
    data: { drafts, rejected },
  };
}
