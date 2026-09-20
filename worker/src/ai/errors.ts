import { AiProviderError, type AiErrorCode } from './types';

/**
 * Structured facts about an upstream failure, when the provider gives us any.
 *
 * Message matching exists only as a **fallback**: sniffing text is stable for nothing, so a provider
 * that declares a status, a type, or a code is believed first, and prose is read only when there is
 * nothing better. This is also what makes a provider swap or a wording change stop being a
 * classification risk.
 */
export interface AiFailureSignal {
  /** HTTP status, when the failure came back as a response rather than a thrown error. */
  status?: number;
  /** Provider-declared error type, e.g. OpenAI's `error.type` (`rate_limit_exceeded`). */
  type?: string;
  /** Provider-declared code, e.g. OpenAI's `error.code` or a Cloudflare numeric platform code. */
  code?: string | number;
}

/**
 * Cloudflare Workers AI platform error codes whose meaning this project has actually observed.
 *
 * Only codes with direct evidence are listed — an unknown numeric code must fall through to the
 * other signals rather than be guessed at, because a wrong `CONTEXT_LIMIT` tells the user to shorten
 * a document that was never the problem.
 */
const PLATFORM_ERROR_CODES: Record<string, AiErrorCode> = {
  // "5021: The estimated number of input and maximum output tokens (8810) exceeded this model
  // context window limit (8192)" — the rejection the prompt budget is derived from.
  '5021': 'CONTEXT_LIMIT',
};

const CONTEXT_HINTS = [
  'context window',
  'context limit',
  'context length',
  'context_length',
  'maximum context',
  'too long',
  'max_tokens',
];
const RATE_LIMIT_HINTS = ['rate limit', 'rate_limit', 'too many requests', 'quota'];

/** Provider-declared type/code as one lowercase haystack, or `''` when none was given. */
function declaredErrorText(signal?: AiFailureSignal): string {
  return [signal?.type, signal?.code]
    .filter((value): value is string | number => value !== undefined && value !== null)
    .map((value) => String(value))
    .join(' ')
    .toLowerCase();
}

/** A numeric code, whether the provider typed it as a number or as digits in a string. */
function numericErrorCode(signal?: AiFailureSignal): string | undefined {
  if (typeof signal?.code === 'number') return String(signal.code);
  if (typeof signal?.code === 'string' && /^\d+$/.test(signal.code)) return signal.code;
  return undefined;
}

/**
 * Maps a provider failure onto a normalized code.
 *
 * Precedence, most trustworthy first:
 * 1. **HTTP status** — a 429 is a rate limit and a 504 is a timeout whatever the body says.
 * 2. **Declared type/code** — the provider's own vocabulary, so a wording change cannot reclassify.
 * 3. **Numeric platform code** — either declared or leading the message (`5021: …`), looked up in
 *    the observed-codes table.
 * 4. **Message text** — last resort, for providers that say what happened and nothing more.
 *
 * Anything unrecognized is `UPSTREAM_ERROR`: a failure the client reports honestly beats one it
 * mislabels as something the user can act on.
 */
export function classifyAiFailure(message: string, signal?: AiFailureSignal): AiErrorCode {
  if (signal?.status === 429) return 'RATE_LIMITED';
  if (signal?.status === 408 || signal?.status === 504) return 'TIMEOUT';

  const declared = declaredErrorText(signal);
  if (declared) {
    if (RATE_LIMIT_HINTS.some((hint) => declared.includes(hint))) return 'RATE_LIMITED';
    if (CONTEXT_HINTS.some((hint) => declared.includes(hint))) return 'CONTEXT_LIMIT';
  }

  const platformCode = numericErrorCode(signal) ?? /^\s*(\d{3,5})\s*:/.exec(message)?.[1];
  if (platformCode && PLATFORM_ERROR_CODES[platformCode]) return PLATFORM_ERROR_CODES[platformCode];

  const lower = message.toLowerCase();
  if (CONTEXT_HINTS.some((hint) => lower.includes(hint))) return 'CONTEXT_LIMIT';
  if (RATE_LIMIT_HINTS.some((hint) => lower.includes(hint))) return 'RATE_LIMITED';

  return 'UPSTREAM_ERROR';
}

/**
 * Reads whatever structured failure facts a thrown value carries.
 *
 * Cloudflare's binding throws ordinary objects, so the HTTP-ish properties are read defensively by
 * type rather than assumed — a provider that declares nothing simply yields `undefined` and the
 * caller falls back to message matching.
 */
export function extractAiFailureSignal(err: unknown): AiFailureSignal | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const candidate = err as { status?: unknown; statusCode?: unknown; code?: unknown; type?: unknown };

  const signal: AiFailureSignal = {};
  const status = candidate.status ?? candidate.statusCode;
  if (typeof status === 'number') signal.status = status;
  if (typeof candidate.code === 'number' || typeof candidate.code === 'string') {
    signal.code = candidate.code;
  }
  if (typeof candidate.type === 'string') signal.type = candidate.type;

  return Object.keys(signal).length > 0 ? signal : undefined;
}

/** Normalizes any thrown value into an `AiProviderError`, classifying the best signal available. */
export function toAiProviderError(
  err: unknown,
  fallbackMessage = 'AI stream failed',
  signal?: AiFailureSignal,
): AiProviderError {
  if (err instanceof AiProviderError) return err;
  const message = err instanceof Error ? err.message : fallbackMessage;
  return new AiProviderError(
    message,
    classifyAiFailure(message, signal ?? extractAiFailureSignal(err)),
  );
}
