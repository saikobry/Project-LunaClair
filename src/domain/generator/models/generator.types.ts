import type { QuestionType } from '../../quiz/models/QuestionType';
import type { QuestionDifficulty } from '../../quiz/models/Question';
import type { QuestionAnswerPayload } from '../../quiz/models/AnswerPayload';

/**
 * Request specification for generating assessment questions from study materials.
 *
 * The source document is deliberately **not** a field: it is resolved from `materialId` by the use
 * case, through the same grounding resolver the chat path uses. A caller-supplied document is an
 * unverifiable second source of truth — it lets a generation run against content the reader would not
 * have offered, and it forces every caller to load the whole document just to open a dialog.
 */
export interface GenerateQuestionsRequest {
  /** Target study material ID; the source document is resolved from it. */
  materialId: string;
  /** Target number of questions to generate (1..10, default: 5). */
  count?: number;
  /** Target difficulty level or 'all' for mixed difficulty. */
  difficulty?: QuestionDifficulty | 'all';
  /** Target question types to generate. If empty or undefined, generates mixed types. */
  types?: QuestionType[];
  /** Optional custom topic or section focus (e.g. "Focus on cardiac conduction"). */
  focusTopic?: string;
  /**
   * App-facing model id from the catalog. Omitted = the catalog default.
   * The model also decides the document cap and the output budget the request runs under.
   */
  model?: string;
  /** Optional abort signal. */
  signal?: AbortSignal;
}

/**
 * Validated in-memory draft of an AI-generated assessment question.
 * Reuses canonical QuestionAnswerPayload domain types.
 */
export interface GeneratedQuestionDraft {
  type: QuestionType;
  prompt: string;
  payload: QuestionAnswerPayload;
  difficulty: QuestionDifficulty;
  points: number;
  explanation?: string;
  tags?: string[];
  sourceSection?: string;
}

/**
 * Request specification for generating flashcards from study materials.
 */
export interface GenerateFlashcardsRequest {
  /** Target study material ID; the source document is resolved from it. */
  materialId: string;
  /** Target number of flashcards to generate (1..15, default: 8). */
  count?: number;
  /** Optional custom topic or section focus. */
  focusTopic?: string;
  /** App-facing model id from the catalog. Omitted = the catalog default. */
  model?: string;
  /** Optional abort signal. */
  signal?: AbortSignal;
}

/**
 * Validated in-memory draft of an AI-generated flashcard.
 */
export interface GeneratedFlashcardDraft {
  front: string;
  back: string;
  explanation?: string;
  sourceSection?: string;
  tags?: string[];
}
