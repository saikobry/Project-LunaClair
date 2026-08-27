import type { Point } from '../reader/annotation.types';
import type { Question } from '../quiz/Question';
import type { SubmittedAnswer } from '../quiz/Answer';
import type { QuizScore } from '../quiz/QuizSession';
import type { EntityVersion, SyncEntityType, SyncMutation } from './sync.types';

/**
 * Model C Payload: locally imported markdown document with version tracking.
 */
export interface DocumentSyncPayload {
  documentId: string;
  title: string;
  content: string;
  updatedAt: string;
  version: EntityVersion;
}

/**
 * Model A Payload: highlight annotation with soft-deletion tombstone.
 */
export interface HighlightSyncPayload {
  id: string;
  documentId: string;
  start: number;
  end: number;
  color: string;
  text: string;
  createdAt: string;
  deletedAt?: string;
}

/**
 * Model A Payload: canvas drawing path with soft-deletion tombstone.
 */
export interface DrawingSyncPayload {
  id: string;
  documentId: string;
  color: string;
  thickness: number;
  points: Point[];
  isEraser?: boolean;
  createdAt: string;
  deletedAt?: string;
}

/**
 * Model A Payload: spaced repetition review scheduling state.
 */
export interface FlashcardReviewSyncPayload {
  key: string;
  materialId?: string;
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  dueAt: string;
  lapses: number;
  lastReviewedAt?: string;
  reviewCount: number;
}

/**
 * Model B Payload: append-only historical assessment session.
 */
export interface QuizSessionSyncPayload {
  id: string;
  quizId: string;
  mode: string;
  status: string;
  questionSnapshots: Record<string, Question>;
  answers: SubmittedAnswer[];
  score?: QuizScore;
  startedAt: string;
  completedAt?: string;
}

/**
 * Type-level mapping from sync entity types to their concrete sync payload interfaces.
 */
export interface SyncPayloadMap {
  document: DocumentSyncPayload;
  highlight: HighlightSyncPayload;
  drawing: DrawingSyncPayload;
  flashcardReview: FlashcardReviewSyncPayload;
  quizSession: QuizSessionSyncPayload;
}

/**
 * Strongly-typed sync mutation envelope constrained by entity type.
 */
export interface TypedSyncMutation<T extends SyncEntityType = SyncEntityType>
  extends SyncMutation<SyncPayloadMap[T]> {
  entityType: T;
  payload: SyncPayloadMap[T];
}
