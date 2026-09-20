import { AiProviderError } from './types';

/**
 * How long a provider may go **without producing an event** before the request is abandoned.
 *
 * This is an *idle* deadline, not a total-duration cap: a response that keeps yielding tokens may
 * stream far longer than this, while a provider that accepts a request and then says nothing — a
 * stalled upstream, a hung socket, a platform binding that never resolves — cannot hold the Worker
 * response open indefinitely.
 */
export const AI_STREAM_IDLE_TIMEOUT_MS = 60_000;

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
 * Races one provider pull against the idle deadline.
 *
 * Providers that can cancel their own outbound request do so through `AiProviderRequest.timeoutMs`;
 * this is the guarantee that does not depend on them. A provider that ignores the deadline — an
 * in-process platform binding, say — still cannot keep the response pending.
 */
export async function withIdleDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number = AI_STREAM_IDLE_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new AiStreamTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
