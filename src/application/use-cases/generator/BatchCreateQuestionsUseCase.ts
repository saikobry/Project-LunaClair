import type { Question, QuestionStatus } from '../../../domain/quiz/models/Question';
import type {
  QuestionRepository,
  CreateQuestionInput,
} from '../../../domain/quiz/repositories/QuestionRepository';
import type { GeneratedQuestionDraft } from '../../../domain/generator/models/generator.types';
import {
  validateQuestionDraft,
  type RejectedDraft,
} from '../../../domain/generator/validation/questionDraftValidation';

export interface BatchCreateQuestionsInput {
  materialId: string;
  questions: GeneratedQuestionDraft[];
  status?: QuestionStatus;
}

/**
 * Outcome of a generated-batch write: the questions that landed, plus the drafts the write
 * boundary refused.
 *
 * `rejected` is empty on the ordinary path — the generator validated every draft and the
 * review step re-validates on edit, so there is nothing left to refuse. It exists so the
 * refusal is *reportable* rather than a silent shortfall, which is the same contract the
 * generator's `DraftBatch` follows.
 */
export interface BatchCreateQuestionsResult {
  /** The persisted questions, in the order they were created. */
  created: Question[];
  /** Drafts this boundary refused, with the reason. Never repaired — see `execute`. */
  rejected: RejectedDraft[];
}

/**
 * Atomically creates a batch of AI-generated questions in IndexedDB.
 * Defaults to 'draft' status for human review before publishing.
 *
 * This is the **single** AI persistence path. A generated flashcard is a `fill_in_blank`
 * question here, not a separate record type: the card projection reads typed questions and
 * expands a cloze into one card per blank, each with its own SM-2 schedule. The draft's
 * declared type, difficulty, and `sourceSection` therefore persist as authored — nothing is
 * stamped onto a `type: 'identification'` row and nothing is hardcoded to `'medium'`.
 *
 * **The write boundary re-validates rather than trusting its input.** The cloze guarantee — a
 * card's front always carries a valid `___` marker — otherwise rests on the generator having
 * validated first, which is a convention, not a construction: a future caller could hand this
 * use case a payload that never went through `validateQuestionDraft`, and the card would
 * *silently* degrade to one whole-question card at projection time (a `___`-less template has
 * no marker to hide, so `questionToCards` falls back to the single-card shape). Rather than
 * write a second, weaker cloze rule here, this calls the same domain validator the generator
 * and the review step call, so there is one rule and the invariant is structural.
 *
 * The re-validation is **not** a second pass over already-validated work in any meaningful
 * sense, and it cannot double-report: `GenerateQuestionsUseCase` hands over only drafts that
 * already passed the very same validator, so on the live path every draft passes again. The
 * only drafts this can reject are ones that reached the boundary *without* passing first —
 * a hand-rolled caller, or a review-step edit that made a valid draft invalid. The generator's
 * own `rejected` list is a different population entirely: those items never arrive here.
 *
 * Failure handling is the generator's salvage policy, not a throw and not a repair: the
 * offending item is dropped and its siblings are still persisted. Repairing is forbidden for
 * the same reason the validator forbids it — a repaired blank would assert an answer nobody
 * supplied, and a dropped template would hide a fact the model did give.
 */
export class BatchCreateQuestionsUseCase {
  private readonly questionRepository: QuestionRepository;

  constructor(questionRepository: QuestionRepository) {
    this.questionRepository = questionRepository;
  }

  async execute(input: BatchCreateQuestionsInput): Promise<BatchCreateQuestionsResult> {
    if (!input.questions || input.questions.length === 0) {
      return { created: [], rejected: [] };
    }

    const rejected: RejectedDraft[] = [];
    const createInputs: CreateQuestionInput[] = [];

    input.questions.forEach((draft, index) => {
      // The gate. A draft that fails here is reported and skipped, never rewritten.
      const validation = validateQuestionDraft(draft);
      if (!validation.success) {
        rejected.push({ index, error: validation.error });
        return;
      }

      // Tags are whatever classification the draft carries — persistence adds no provenance marker.
      // `sourceSection` is the provenance record itself, so unlike a tag it IS persisted: the
      // draft's declared difficulty, payload type, and section all reach the bank intact.
      createInputs.push({
        materialId: input.materialId,
        type: draft.type,
        prompt: draft.prompt,
        payload: draft.payload,
        difficulty: draft.difficulty,
        points: draft.points,
        explanation: draft.explanation,
        tags: draft.tags ?? [],
        sourceSection: draft.sourceSection,
        status: input.status ?? 'draft',
      });
    });

    if (createInputs.length === 0) {
      return { created: [], rejected };
    }

    return {
      created: await this.questionRepository.createQuestionsBatch(createInputs),
      rejected,
    };
  }
}
