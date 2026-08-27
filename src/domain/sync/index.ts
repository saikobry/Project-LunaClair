// Primitive Types & Enums
export type {
  SyncEntityType,
  SyncOperation,
  SyncStatus,
  EntityVersion,
  SyncCursor,
  SessionCredentials,
  SyncMutation,
  SyncQueueItem,
  SyncState,
  ConflictDraft,
  ReconcileResult,
} from './sync.types';

// Sync Model Categorization
export { type SyncModel, getSyncModelForEntity } from './sync.models';

// Identity Helpers
export { createSyncStateKey, isValidSyncIdentity } from './sync.identity';

// Cursor Management & Monotonicity
export { isValidSyncCursor, assertCursorMonotonic, advanceSyncCursor } from './sync.cursor';

// Typed Entity Payloads
export type {
  DocumentSyncPayload,
  HighlightSyncPayload,
  DrawingSyncPayload,
  FlashcardReviewSyncPayload,
  QuizSessionSyncPayload,
  SyncPayloadMap,
  TypedSyncMutation,
} from './sync.entities';

// Versioning & Concurrency Resolution
export {
  evaluateDocumentConcurrency,
  nextEntityVersion,
  compareLwwTimestamps,
  compareFlashcardReviews,
} from './sync.versioning';

// Domain Errors
export {
  SyncConflictError,
  OptimisticConcurrencyError,
  InvalidSyncPayloadError,
  InvalidSyncCursorError,
  OutboxTransactionError,
} from './sync.errors';

// Repository Contracts
export type { SyncQueueRepository } from './repositories/SyncQueueRepository';
export type { SyncStateRepository } from './repositories/SyncStateRepository';
export type { ConflictDraftRepository } from './repositories/ConflictDraftRepository';
