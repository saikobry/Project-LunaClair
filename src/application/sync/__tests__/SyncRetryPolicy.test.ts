import { describe, it, expect } from 'vitest';
import {
  calculateRetryDelay,
  createSyncRetryPolicy,
  DEFAULT_SYNC_RETRY_OPTIONS,
} from '../policies/syncRetryPolicy';
import { SyncNetworkError, SyncHttpError } from '../../../domain/sync/errors/SyncErrors';

describe('SyncRetryPolicy & calculateRetryDelay', () => {
  it('exposes standard DEFAULT_SYNC_RETRY_OPTIONS', () => {
    expect(DEFAULT_SYNC_RETRY_OPTIONS.maxRetries).toBe(5);
    expect(DEFAULT_SYNC_RETRY_OPTIONS.initialDelayMs).toBe(1000);
  });

  it('calculates exponential backoff delays deterministically when jitter is false', () => {
    const opts = {
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffFactor: 2,
      maxRetries: 5,
      jitter: false,
    };

    expect(calculateRetryDelay(0, opts)).toBe(1000);
    expect(calculateRetryDelay(1, opts)).toBe(2000);
    expect(calculateRetryDelay(2, opts)).toBe(4000);
    expect(calculateRetryDelay(3, opts)).toBe(8000);
    expect(calculateRetryDelay(4, opts)).toBe(16000);
    expect(calculateRetryDelay(5, opts)).toBe(30000); // capped at maxDelayMs
    expect(calculateRetryDelay(10, opts)).toBe(30000);
  });

  it('bounds delays with jitter within [0, cappedDelay]', () => {
    const opts = {
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffFactor: 2,
      maxRetries: 5,
      jitter: true,
    };

    for (let attempt = 0; attempt <= 5; attempt++) {
      const delay = calculateRetryDelay(attempt, opts);
      const maxExpected = Math.min(1000 * Math.pow(2, attempt), 30000);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(maxExpected);
    }
  });

  it('evaluates shouldRetry based on attempt counter and error retryability', () => {
    const policy = createSyncRetryPolicy({ maxRetries: 3 });

    // Under maxRetries
    expect(policy.shouldRetry(0)).toBe(true);
    expect(policy.shouldRetry(1)).toBe(true);
    expect(policy.shouldRetry(2)).toBe(true);

    // At or over maxRetries
    expect(policy.shouldRetry(3)).toBe(false);
    expect(policy.shouldRetry(4)).toBe(false);

    // Error classification checks
    const networkErr = new SyncNetworkError('Failed to fetch');
    expect(policy.shouldRetry(1, networkErr)).toBe(true);

    const http500 = new SyncHttpError(500, 'Server Error');
    expect(policy.shouldRetry(1, http500)).toBe(true);

    const http400 = new SyncHttpError(400, 'Bad Request');
    expect(policy.shouldRetry(1, http400)).toBe(false);
  });
});
