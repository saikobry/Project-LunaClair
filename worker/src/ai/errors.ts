import { AiProviderError, type AiErrorCode } from './types';

/**
 * Maps an unclassified provider message onto a failure code.
 *
 * Providers that classify their own HTTP responses (see `ukisai.ts`) throw an already-typed
 * `AiProviderError`; this exists for the ones that cannot — Workers AI surfaces rejections as thrown
 * errors carrying the platform's message, e.g. `5021: The estimated number of input and maximum
 * output tokens (8810) exceeded this model context window limit (8192)`. Without this, a context
 * rejection or a rate limit would be reported as a generic upstream failure and the client could not
 * tell the user what to change.
 */
export function classifyAiFailureMessage(message: string): AiErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes('context window') || lower.includes('context limit')) return 'CONTEXT_LIMIT';
  if (lower.includes('rate limit') || lower.includes('too many requests')) return 'RATE_LIMITED';
  return 'UPSTREAM_ERROR';
}

/** Normalizes any thrown value into an `AiProviderError`, classifying an untyped message. */
export function toAiProviderError(
  err: unknown,
  fallbackMessage = 'AI stream failed',
): AiProviderError {
  if (err instanceof AiProviderError) return err;
  const message = err instanceof Error ? err.message : fallbackMessage;
  return new AiProviderError(message, classifyAiFailureMessage(message));
}
