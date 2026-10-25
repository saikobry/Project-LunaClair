import type { JournalOp } from '../reconcilers/plugins/MergePlugin';

export type SyncEntityType = 'document' | 'highlight' | 'drawing' | 'flashcardReview' | 'quizSession' | 'pointer';

export type SyncOperation = 'UPSERT' | 'DELETE' | 'APPEND';

export type SyncStatus = 'pending' | 'failed';

/**
 * Monotonically increasing version counter for versioned entities (Model C).
 * 0 = not existing locally / unversioned,
 * 1 = first cloud version,
 * 2 = subsequent revision.
 */
export type EntityVersion = number;

/**
 * Monotonically increasing server change sequence counter per user.
 */
export type SyncCursor = number;

export interface SessionCredentials {
  userId: string;
  deviceId: string;
  token?: string;
}

/**
 * Canonical mutation envelope produced when local changes occur.
 */
export interface SyncMutation<T = unknown> {
  /** Globally unique logical mutation UUID, preserved on retries. */
  clientMutationId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  baseVersion?: EntityVersion;
  clientTimestamp: string; // ISO-8601 UTC
  payload: T;
}

/**
 * Local persistent outbox queue record for an outgoing mutation.
 */
export interface SyncQueueItem<T = unknown> {
  /** Local queue record ID (UUID). */
  id: string;
  /** Logical mutation UUID. */
  clientMutationId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  baseVersion?: EntityVersion;
  clientTimestamp: string;
  payload: T;
  status: SyncStatus;
  createdAt: string;
  retryCount: number;
  lastAttemptAt?: string;
  lastError?: string;
}

/**
 * Local synchronization checkpoint state per user & device pairing.
 */
export interface SyncState {
  /** Composite key: `${userId}:${deviceId}` */
  key: string;
  userId: string;
  deviceId: string;
  lastServerCursor: SyncCursor;
  checkpointRevision?: number;
  lastSyncedAt?: string;
  /** Google Drive BYOS transport state */
  pageToken?: string;
  appliedFileIds?: string[];
  pendingFileProgress?: PullFileProgress;
  pendingDiscovery?: PendingDiscoveryState;
  peerWatermarks?: Record<string, string>;
  driveSeeded?: boolean;
}

export interface PendingDiscoveryState {
  candidateFileIds: string[];
  completedFileIds: string[];
  pendingTokenToCommit?: string;
  hasMorePages?: boolean;
}

/**
 * Conflict draft snapshot stored when concurrent document edits diverge.
 */
export interface ConflictDraft {
  id: string;
  documentId: string;
  baseVersion: EntityVersion;
  serverVersion: EntityVersion;
  localContent: string;
  serverContent: string;
  createdAt: string;
}

/**
 * Result of reconciling an incoming server change with local state.
 */
export type ReconcileResult =
  | { kind: 'applied'; entityId: string; version?: EntityVersion }
  | { kind: 'ignored'; entityId: string; reason: string }
  | { kind: 'conflict'; entityId: string; draft: ConflictDraft }
  | { kind: 'deleted'; entityId: string };

/**
 * Accepted mutation item returned by sync transport push.
 */
export interface AcceptedMutation {
  clientMutationId: string;
  entityType?: string;
  entityId: string;
  newVersion?: number;
}

/**
 * Conflict mutation item returned by sync transport push on concurrency violation.
 */
export interface ConflictMutation {
  clientMutationId: string;
  entityType?: string;
  entityId: string;
  serverVersion: number;
  serverPayload: unknown;
}

/**
 * Rejected mutation item returned by sync transport push when invalid or malformed.
 */
export interface RejectedMutation {
  clientMutationId: string;
  entityType?: string;
  entityId?: string;
  reason: string;
}

/**
 * Request payload for sync transport push.
 */
export interface SyncPushRequest {
  deviceId: string;
  mutations: SyncMutation[];
}

/**
 * Response payload for sync transport push.
 */
export interface SyncPushResponse {
  accepted: AcceptedMutation[];
  conflicts: ConflictMutation[];
  rejected: RejectedMutation[];
}

/**
 * Journal change delta entry returned by sync transport pull.
 */
export interface SyncChangeItem<T = unknown> {
  sequence: number;
  entityType: SyncEntityType | string;
  entityId: string;
  operation: SyncOperation | string;
  version?: number;
  changedAt: string;
  data: T;
}

export interface PullFileProgress {
  fileId: string;
  offset: number;
  totalMutations?: number;
}

export interface PullReceipt {
  receiptId: string;
  userId: string;
  deviceId: string;
  baseCursor?: number;
  baseRevision?: number;
  appliedFileIds: string[];
  pendingFileProgress?: PullFileProgress;
  pendingDiscovery?: PendingDiscoveryState;
  pageToken?: string;
  peerWatermarks?: Record<string, string>;
}

/**
 * Response payload for sync transport pull.
 */
export interface SyncPullResponse {
  newCursor: number;
  hasMore: boolean;
  changes: SyncChangeItem[];
  receipt?: PullReceipt;
}

export interface HeldOp {
  id: string;
  op: JournalOp;
  reason?: 'unknown-entity' | 'newer-schema' | string;
  error?: string;
  heldAt?: string;
}

export interface PendingHydration {
  originShareId: string;
  attempts: number;
  nextAttemptAt: number;
  title?: string;
  publishedAt?: string;
  schemaVersion?: number;
  lastError?: string;
}

export interface TombstoneRecord {
  id: string;
  entity: string;
  key: string;
  hlc: string;
}

export type TombstoneRow = TombstoneRecord;
