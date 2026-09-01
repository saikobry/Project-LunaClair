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
export { type SyncModel, getSyncModelForEntity } from './SyncModels';

// Identity Helpers
export { createSyncStateKey, isValidSyncIdentity } from './syncIdentity';

// Cursor Management & Monotonicity
export { isValidSyncCursor, assertCursorMonotonic, advanceSyncCursor } from './syncCursor';

// Typed Entity Payloads
export type {
  DocumentSyncPayload,
  HighlightSyncPayload,
  DrawingSyncPayload,
  FlashcardReviewSyncPayload,
  QuizSessionSyncPayload,
  SyncPayloadMap,
  TypedSyncMutation,
} from './SyncEntities';

// Versioning & Concurrency Resolution
export {
  evaluateDocumentConcurrency,
  nextEntityVersion,
  compareLwwTimestamps,
  compareFlashcardReviews,
} from './syncVersioning';

// Domain Errors
export {
  SyncError,
  SyncNetworkError,
  SyncHttpError,
  SyncProtocolError,
  SyncConflictError,
  OptimisticConcurrencyError,
  InvalidSyncPayloadError,
  InvalidSyncCursorError,
  OutboxTransactionError,
} from './SyncErrors';

// Pure Domain Reconcilers
export {
  reconcileDocument,
  type LocalDocumentState,
  type DocumentReconcileResult,
  reconcileTimestampLww,
  type LwwTimestampEntity,
  type LwwReconcileResult,
  reconcileFlashcardReview,
  type FlashcardReconcileResult,
  reconcileQuizSession,
  type QuizSessionReconcileResult,
} from './reconcilers';

// Transport Port & DTOs
export type {
  SyncTransport,
  SyncPushRequest,
  SyncPushResponse,
  SyncPullResponse,
} from './SyncTransport';

// Session Credentials Port
export type { SessionCredentialsProvider } from './SessionCredentialsProvider';

// Retry Policies & Exponential Backoff
export {
  type SyncRetryPolicyOptions,
  type SyncRetryPolicy,
  DEFAULT_SYNC_RETRY_OPTIONS,
  calculateRetryDelay,
  createSyncRetryPolicy,
} from './SyncRetryPolicy';

// Repository Contracts
export type { SyncQueueRepository } from './repositories/SyncQueueRepository';
export type { SyncStateRepository } from './repositories/SyncStateRepository';
export type { ConflictDraftRepository, ResolveConflictInput } from './repositories/ConflictDraftRepository';

// Reconciliation Port
export type {
  SyncReconciler,
  ReconcilePullResult,
  ApplyPushResult,
} from './SyncReconciler';


