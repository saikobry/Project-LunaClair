import { AiProviderError } from './types';

/**
 * How long a provider has to produce its **first** event.
 *
 * Deliberately shorter than the client's first-token watchdog (30s, `AI_FIRST_TOKEN_TIMEOUT_MS`), so
 * the Worker is the party that reports a stalled provider first: its failure is coded (`TIMEOUT`, 504)
 * and its message is specific, while the client's is a generic "did not start responding". When the
 * client wins this race the server's authoritative answer never reaches anyone.
 */
export const AI_FIRST_EVENT_TIMEOUT_MS = 25_000;

/**
 * How long a provider may go **without producing an event** once it has started.
 *
 * This is an *idle* deadline, not a total-duration cap: a response that keeps yielding tokens may
 * stream far longer than this, while one that stops producing — a stalled upstream, a hung socket —
 * cannot hold the Worker response open indefinitely.
 */
export const AI_STREAM_IDLE_TIMEOUT_MS = 45_000;

interface TimeoutSignal {
  /** Aborts when the deadline elapses or the caller's signal aborts. */
  signal: AbortSignal;
  /** Clears the deadline timer and the caller's listener. Always call this when done. */
  clear: () => void;
  /** True when the deadline itself elapsed (as opposed to the caller aborting). */
  timedOut: () => boolean;
}

/**
 * Composes a caller's abort signal with an internal deadline.
 *
 * Hand-rolled rather than `AbortSignal.any`/`AbortSignal.timeout` so the behaviour is identical in
 * the Worker runtime, in Vitest's node environment, and in tests that drive fake timers.
 */
export function createTimeoutSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
  message = 'The AI provider did not respond in time.',
): TimeoutSignal {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new AiProviderError(message, 'TIMEOUT'));
  }, timeoutMs);

  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }

  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    },
    timedOut: () => timedOut,
  };
}

/** Raised when a provider pull outlives the idle deadline; carries the coded failure to the route. */
export class AiStreamTimeoutError extends AiProviderError {
  constructor(message = 'The AI provider stopped responding.') {
    super(message, 'TIMEOUT');
    this.name = 'AiStreamTimeoutError';
  }
}

/**
 * Races one provider pull against a deadline, **cancelling** the work when the deadline wins.
 *
 * `onTimeout` runs exactly once, immediately before the rejection, and is how the caller turns
 * "this promise is abandoned" into "this work is over": the route aborts the provider's signal there
 * rather than leaving a live socket (or a pending binding) behind the rejected race.
 *
 * The timer is always cleared, so a pull that resolves first never leaves one armed.
 */
export async function withIdleDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number = AI_STREAM_IDLE_TIMEOUT_MS,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          try {
            onTimeout?.();
          } finally {
            reject(new AiStreamTimeoutError());
          }
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
