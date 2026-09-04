import type { GeneratedQuestionDraft, GeneratedFlashcardDraft } from '../models/generator.types';
import type { QuestionType } from '../../quiz/models/QuestionType';
import type { QuestionDifficulty } from '../../quiz/models/Question';
import type { QuestionAnswerPayload } from '../../quiz/models/AnswerPayload';

const VALID_QUESTION_TYPES: Set<QuestionType> = new Set([
  'multiple_choice',
  'multiple_select',
  'true_false',
  'identification',
  'fill_in_blank',
]);

const VALID_DIFFICULTIES: Set<QuestionDifficulty> = new Set(['easy', 'medium', 'hard']);

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

  if (typeof obj.type !== 'string' || !VALID_QUESTION_TYPES.has(obj.type as QuestionType)) {
    return { success: false, error: `Invalid question type: ${String(obj.type)}` };
  }

  const type = obj.type as QuestionType;
  const difficulty: QuestionDifficulty =
    typeof obj.difficulty === 'string' && VALID_DIFFICULTIES.has(obj.difficulty as QuestionDifficulty)
      ? (obj.difficulty as QuestionDifficulty)
      : 'medium';

  const points = typeof obj.points === 'number' && obj.points > 0 ? obj.points : 1;
  const explanation = typeof obj.explanation === 'string' ? obj.explanation.trim() : undefined;
  const sourceSection = typeof obj.sourceSection === 'string' ? obj.sourceSection.trim() : undefined;
  const tags = Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : [];

  // Validate payload per question type
  const payloadObj = (obj.payload && typeof obj.payload === 'object' ? obj.payload : obj) as Record<
    string,
    unknown
  >;

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

      let correctIndex = typeof payloadObj.correctIndex === 'number' ? payloadObj.correctIndex : -1;
      // Handle string answer matching if correctIndex is missing
      if (correctIndex < 0 || correctIndex >= choices.length) {
        if (typeof payloadObj.correctAnswer === 'string') {
          correctIndex = choices.indexOf(payloadObj.correctAnswer.trim());
        }
      }

      // If missing or invalid, default to 0 so the draft can be edited in review
      if (correctIndex < 0 || correctIndex >= choices.length) {
        correctIndex = 0;
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
      let correctIndices = Array.isArray(payloadObj.correctIndices)
        ? payloadObj.correctIndices.filter(
            (idx): idx is number => typeof idx === 'number' && idx >= 0 && idx < choices.length,
          )
        : [];

      if (correctIndices.length === 0) {
        correctIndices = [0];
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
      if (!template) {
        return { success: false, error: 'fill_in_blank requires template with blank placeholder' };
      }

      const blanks = Array.isArray(payloadObj.blanks)
        ? payloadObj.blanks.flatMap((b) => {
            const trimmed = String(b).trim();
            return trimmed ? [trimmed] : [];
          })
        : [];

      if (blanks.length === 0) {
        return { success: false, error: 'fill_in_blank requires at least 1 blank answer' };
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
 * Validates an array of question drafts from AI output.
 */
export function validateQuestionsDraftArray(
  data: unknown,
): { success: true; data: GeneratedQuestionDraft[] } | { success: false; error: string } {
  if (!Array.isArray(data)) {
    return { success: false, error: 'Expected an array of questions' };
  }

  if (data.length === 0) {
    return { success: false, error: 'AI generated an empty array of questions' };
  }

  const validatedQuestions: GeneratedQuestionDraft[] = [];
  for (let i = 0; i < data.length; i++) {
    const res = validateQuestionDraft(data[i]);
    if (!res.success) {
      return { success: false, error: `Item ${i + 1} is invalid: ${res.error}` };
    }
    validatedQuestions.push(res.data);
  }

  return {
    success: true,
    data: validatedQuestions,
  };
}

/**
 * Validates an array of flashcard drafts from AI output.
 */
export function validateFlashcardsDraftArray(
  data: unknown,
): { success: true; data: GeneratedFlashcardDraft[] } | { success: false; error: string } {
  if (!Array.isArray(data)) {
    return { success: false, error: 'Expected an array of flashcards' };
  }

  if (data.length === 0) {
    return { success: false, error: 'AI generated an empty array of flashcards' };
  }

  const validatedCards: GeneratedFlashcardDraft[] = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== 'object') {
      return { success: false, error: `Card ${i + 1} must be an object` };
    }
    const obj = item as Record<string, unknown>;
    const front = typeof obj.front === 'string' ? obj.front.trim() : '';
    const back = typeof obj.back === 'string' ? obj.back.trim() : '';
    if (!front || !back) {
      return { success: false, error: `Card ${i + 1} requires non-empty front and back text` };
    }

    validatedCards.push({
      front,
      back,
      explanation: typeof obj.explanation === 'string' ? obj.explanation.trim() : undefined,
      sourceSection: typeof obj.sourceSection === 'string' ? obj.sourceSection.trim() : undefined,
      tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : [],
    });
  }

  return {
    success: true,
    data: validatedCards,
  };
}
