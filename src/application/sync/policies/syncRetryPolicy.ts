import {
  createSyncRetryPolicy,
  calculateRetryDelay,
  DEFAULT_SYNC_RETRY_OPTIONS,
  type SyncRetryPolicy,
  type SyncRetryPolicyOptions,
} from '../../../domain/sync';

export {
  calculateRetryDelay,
  createSyncRetryPolicy,
  DEFAULT_SYNC_RETRY_OPTIONS,
  type SyncRetryPolicy,
  type SyncRetryPolicyOptions,
};

/**
 * Default global synchronization exponential backoff retry policy instance:
 * - initialDelayMs: 1000
 * - maxDelayMs: 30000
 * - backoffFactor: 2
 * - maxRetries: 5
 * - jitter: true
 */
export const defaultSyncRetryPolicy = createSyncRetryPolicy();
