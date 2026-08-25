import type { QuestionType } from '../quiz/QuestionType';
import type { QuestionDifficulty } from '../quiz/Question';
import type { QuestionAnswerPayload } from '../quiz/AnswerPayload';

/**
 * Request specification for generating assessment questions from study materials.
 */
export interface GenerateQuestionsRequest {
  /** Target study material ID. */
  materialId: string;
  /** Document markdown content from which to synthesize questions. */
  documentMarkdown: string;
  /** Target number of questions to generate (1..10, default: 5). */
  count?: number;
  /** Target difficulty level or 'all' for mixed difficulty. */
  difficulty?: QuestionDifficulty | 'all';
  /** Target question types to generate. If empty or undefined, generates mixed types. */
  types?: QuestionType[];
  /** Optional custom topic or section focus (e.g. "Focus on cardiac conduction"). */
  focusTopic?: string;
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
  /** Target study material ID. */
  materialId: string;
  /** Document markdown content. */
  documentMarkdown: string;
  /** Target number of flashcards to generate (1..15, default: 8). */
  count?: number;
  /** Optional custom topic or section focus. */
  focusTopic?: string;
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
