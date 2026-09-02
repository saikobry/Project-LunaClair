import type { ConflictDraft, EntityVersion, SyncEntityType } from '../models/sync.types';

/**
 * Base abstract class for all synchronization domain and transport errors.
 */
export abstract class SyncError extends Error {
  readonly isRetryable: boolean;

  constructor(message: string, isRetryable: boolean = false) {
    super(message);
    this.name = 'SyncError';
    this.isRetryable = isRetryable;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when network connectivity fails, request times out, or fetch encounters offline state.
 * Always retryable (`isRetryable: true`).
 */
export class SyncNetworkError extends SyncError {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message, true);
    this.name = 'SyncNetworkError';
    this.cause = cause;
    Object.setPrototypeOf(this, SyncNetworkError.prototype);
  }
}

/**
 * Thrown when the sync HTTP endpoint returns a non-2xx status code.
 * Retryable for 5xx server errors and 429 rate limit responses (`isRetryable: status >= 500 || status === 429`).
 */
export class SyncHttpError extends SyncError {
  readonly status: number;
  readonly responseBody?: unknown;

  constructor(status: number, responseBody?: unknown, message?: string) {
    const isRetryable = status >= 500 || status === 429;
    super(
      message ?? `Sync HTTP request failed with status ${status}`,
      isRetryable
    );
    this.name = 'SyncHttpError';
    this.status = status;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, SyncHttpError.prototype);
  }
}

/**
 * Thrown when the sync endpoint returns malformed JSON or an invalid payload schema violating protocol contracts.
 * Non-retryable (`isRetryable: false`).
 */
export class SyncProtocolError extends SyncError {
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message, false);
    this.name = 'SyncProtocolError';
    this.details = details;
    Object.setPrototypeOf(this, SyncProtocolError.prototype);
  }
}

/**
 * Thrown when a sync conflict occurs that requires branching into a conflict draft.
 */
export class SyncConflictError extends SyncError {
  readonly entityId: string;
  readonly entityType: SyncEntityType;
  readonly draft?: ConflictDraft;

  constructor(message: string, entityId: string, entityType: SyncEntityType, draft?: ConflictDraft) {
    super(message, false);
    this.name = 'SyncConflictError';
    this.entityId = entityId;
    this.entityType = entityType;
    this.draft = draft;
    Object.setPrototypeOf(this, SyncConflictError.prototype);
  }
}

/**
 * Thrown when an optimistic concurrency check fails (baseVersion != serverVersion).
 */
export class OptimisticConcurrencyError extends SyncError {
  readonly entityId: string;
  readonly baseVersion: EntityVersion;
  readonly serverVersion: EntityVersion;

  constructor(entityId: string, baseVersion: EntityVersion, serverVersion: EntityVersion, message?: string) {
    super(
      message ??
        `Optimistic concurrency conflict for entity '${entityId}': base version ${baseVersion} does not match server version ${serverVersion}`,
      false
    );
    this.name = 'OptimisticConcurrencyError';
    this.entityId = entityId;
    this.baseVersion = baseVersion;
    this.serverVersion = serverVersion;
    Object.setPrototypeOf(this, OptimisticConcurrencyError.prototype);
  }
}

/**
 * Thrown when a mutation payload is malformed or violates domain invariants.
 */
export class InvalidSyncPayloadError extends SyncError {
  readonly entityType?: string;
  readonly reason?: string;

  constructor(message: string, entityType?: string, reason?: string) {
    super(message, false);
    this.name = 'InvalidSyncPayloadError';
    this.entityType = entityType;
    this.reason = reason;
    Object.setPrototypeOf(this, InvalidSyncPayloadError.prototype);
  }
}

/**
 * Thrown when a sync cursor is invalid or non-monotonic.
 */
export class InvalidSyncCursorError extends SyncError {
  readonly cursor?: unknown;

  constructor(message: string, cursor?: unknown) {
    super(message, false);
    this.name = 'InvalidSyncCursorError';
    this.cursor = cursor;
    Object.setPrototypeOf(this, InvalidSyncCursorError.prototype);
  }
}

/**
 * Thrown when an outbox persistence or atomic queue transaction fails.
 */
export class OutboxTransactionError extends SyncError {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message, false);
    this.name = 'OutboxTransactionError';
    this.cause = cause;
    Object.setPrototypeOf(this, OutboxTransactionError.prototype);
  }
}
