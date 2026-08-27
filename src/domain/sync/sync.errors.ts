import type { ConflictDraft, EntityVersion, SyncEntityType } from './sync.types';

/**
 * Thrown when a sync conflict occurs that requires branching into a conflict draft.
 */
export class SyncConflictError extends Error {
  readonly entityId: string;
  readonly entityType: SyncEntityType;
  readonly draft?: ConflictDraft;

  constructor(message: string, entityId: string, entityType: SyncEntityType, draft?: ConflictDraft) {
    super(message);
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
export class OptimisticConcurrencyError extends Error {
  readonly entityId: string;
  readonly baseVersion: EntityVersion;
  readonly serverVersion: EntityVersion;

  constructor(entityId: string, baseVersion: EntityVersion, serverVersion: EntityVersion, message?: string) {
    super(
      message ??
        `Optimistic concurrency conflict for entity '${entityId}': base version ${baseVersion} does not match server version ${serverVersion}`
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
export class InvalidSyncPayloadError extends Error {
  readonly entityType?: string;
  readonly reason?: string;

  constructor(message: string, entityType?: string, reason?: string) {
    super(message);
    this.name = 'InvalidSyncPayloadError';
    this.entityType = entityType;
    this.reason = reason;
    Object.setPrototypeOf(this, InvalidSyncPayloadError.prototype);
  }
}

/**
 * Thrown when a sync cursor is invalid or non-monotonic.
 */
export class InvalidSyncCursorError extends Error {
  readonly cursor?: unknown;

  constructor(message: string, cursor?: unknown) {
    super(message);
    this.name = 'InvalidSyncCursorError';
    this.cursor = cursor;
    Object.setPrototypeOf(this, InvalidSyncCursorError.prototype);
  }
}

/**
 * Thrown when an outbox persistence or atomic queue transaction fails.
 */
export class OutboxTransactionError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'OutboxTransactionError';
    this.cause = cause;
    Object.setPrototypeOf(this, OutboxTransactionError.prototype);
  }
}
