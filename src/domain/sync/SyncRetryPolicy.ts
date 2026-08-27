/**
 * Sync Retry Policy Domain Contract & Utilities.
 *
 * Defines exponential backoff parameters with jitter for resilient cloud sync retries.
 */

export interface SyncRetryPolicyOptions {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffFactor: number;
  readonly maxRetries: number;
  readonly jitter?: boolean;
}

export const DEFAULT_SYNC_RETRY_OPTIONS: SyncRetryPolicyOptions = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  maxRetries: 5,
  jitter: true,
};

export interface SyncRetryPolicy {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffFactor: number;
  readonly maxRetries: number;
  readonly jitter: boolean;

  /**
   * Calculates retry delay in milliseconds for a specific retry attempt counter.
   */
  calculateDelay(attempt: number): number;

  /**
   * Evaluates if another retry attempt is permitted based on attempt count and error type.
   */
  shouldRetry(attempt: number, error?: unknown): boolean;
}

/**
 * Pure helper function calculating exponential backoff delay with optional jitter.
 *
 * Formula:
 * - baseDelay = initialDelayMs * (backoffFactor ^ attempt)
 * - cappedDelay = min(baseDelay, maxDelayMs)
 * - if jitter is enabled: delay = Math.floor(Math.random() * cappedDelay)
 */
export function calculateRetryDelay(
  attempt: number,
  options: Partial<SyncRetryPolicyOptions> = {}
): number {
  const initial = options.initialDelayMs ?? DEFAULT_SYNC_RETRY_OPTIONS.initialDelayMs;
  const max = options.maxDelayMs ?? DEFAULT_SYNC_RETRY_OPTIONS.maxDelayMs;
  const factor = options.backoffFactor ?? DEFAULT_SYNC_RETRY_OPTIONS.backoffFactor;
  const jitter = options.jitter ?? DEFAULT_SYNC_RETRY_OPTIONS.jitter ?? true;

  const normAttempt = Math.max(0, attempt);
  const exponential = initial * Math.pow(factor, normAttempt);
  const capped = Math.min(exponential, max);

  if (jitter) {
    return Math.floor(Math.random() * capped);
  }

  return Math.floor(capped);
}

/**
 * Factory creating a `SyncRetryPolicy` instance.
 */
export function createSyncRetryPolicy(options: Partial<SyncRetryPolicyOptions> = {}): SyncRetryPolicy {
  const config: SyncRetryPolicyOptions = {
    initialDelayMs: options.initialDelayMs ?? DEFAULT_SYNC_RETRY_OPTIONS.initialDelayMs,
    maxDelayMs: options.maxDelayMs ?? DEFAULT_SYNC_RETRY_OPTIONS.maxDelayMs,
    backoffFactor: options.backoffFactor ?? DEFAULT_SYNC_RETRY_OPTIONS.backoffFactor,
    maxRetries: options.maxRetries ?? DEFAULT_SYNC_RETRY_OPTIONS.maxRetries,
    jitter: options.jitter ?? DEFAULT_SYNC_RETRY_OPTIONS.jitter ?? true,
  };

  return {
    ...config,
    jitter: config.jitter ?? true,
    calculateDelay(attempt: number): number {
      return calculateRetryDelay(attempt, config);
    },
    shouldRetry(attempt: number, error?: unknown): boolean {
      if (attempt >= config.maxRetries) {
        return false;
      }
      if (error && typeof error === 'object' && 'isRetryable' in error) {
        return Boolean((error as { isRetryable: boolean }).isRetryable);
      }
      return true;
    },
  };
}
