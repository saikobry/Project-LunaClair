import type { AiTokenUsage } from '../core/aiUsage';

/**
 * One structured record per `/api/ai/chat` request — the Worker's only view of how the AI feature
 * actually behaves.
 *
 * Every request used to log nothing unless it failed, which left the whole feature's real behaviour
 * unmeasurable: whether the first-event and idle deadlines are anywhere near reality, how often MAX
 * is rate-limited for users who are not the one testing it, what a turn costs, and which party gives
 * up first when a provider stalls. This record answers those without a second sink to operate: it is
 * a structured object, written with `console`, so Cloudflare stores it in Workers Logs with its
 * fields indexed and queryable. That requires the Worker's `observability` setting (`wrangler.jsonc`) —
 * without it `console` output is only visible live through `wrangler tail` and is not retained.
 *
 * **It must never carry prompt, document, or selection content.** Ids, counts, durations, and the
 * provider's own error text only — the provider's message describes the vendor's refusal (a rate
 * limit, a context rejection) rather than anything the user wrote. Nothing here is user-supplied by
 * construction, and `worker/src/ai/__tests__/telemetry.test.ts` pins that shape.
 */
export type AiRequestOutcome =
  /** Answered, at least in part. A late mid-stream failure still counts as `error`. */
  | 'ok'
  /** A provider or platform failure, pre-stream or mid-stream. */
  | 'error'
  /** Cancelled — the client went away, or the consumer stopped reading. Not a fault. */
  | 'aborted'
  /** Refused before any provider work: the assistant is off, or the model is not servable. */
  | 'rejected';

/** Where in the request lifecycle execution completed or halted. */
export type AiRequestStage = 'pre-stream' | 'mid-stream';

/** Causal trigger for cancellation or rejection. */
export type AiRequestReason =
  | 'client-abort'
  | 'consumer-cancel'
  | 'global-shutdown'
  | 'model-disabled'
  | 'model-unknown'
  | 'provider-unconfigured'
  | 'timeout';

export const MAX_TELEMETRY_MESSAGE_CHARS = 256;

/** Normalized operational messages for standard error codes to prevent raw vendor echo leaks. */
export const SAFE_CODE_MESSAGES: Record<string, string> = {
  RATE_LIMITED: 'Rate limit exceeded',
  CONTEXT_LIMIT: 'Context window limit exceeded',
  TIMEOUT: 'Request timed out',
  PROVIDER_UNAVAILABLE: 'Provider unavailable',
  MODEL_UNAVAILABLE: 'Model unavailable',
  AI_DISABLED: 'AI is disabled',
  UPSTREAM_ERROR: 'Upstream provider error',
  ABORTED: 'Request aborted',
};

/**
 * Sanitizes and caps an operational message to at most MAX_TELEMETRY_MESSAGE_CHARS (256).
 */
export function sanitizeTelemetryMessage(message?: string): string | undefined {
  if (typeof message !== 'string') return undefined;
  const trimmed = message.trim();
  if (!trimmed) return undefined;
  const suffix = '...';
  if (trimmed.length > MAX_TELEMETRY_MESSAGE_CHARS) {
    return `${trimmed.slice(0, MAX_TELEMETRY_MESSAGE_CHARS - suffix.length)}${suffix}`;
  }
  return trimmed;
}

/**
 * Returns a guaranteed-safe operational description for telemetry, preferring known codes
 * over unvetted upstream vendor text.
 */
export function safeTelemetryMessage(code?: string, rawMessage?: string): string | undefined {
  if (code && SAFE_CODE_MESSAGES[code]) {
    return SAFE_CODE_MESSAGES[code];
  }
  return sanitizeTelemetryMessage(rawMessage);
}

export interface AiRequestTelemetry {
  /** HTTP status code delivered to the client (e.g. 200, 400, 429, 499, 503, 504). */
  status: number;
  /** Catalog id the request resolved to, or `null` when it never got that far. */
  model: string | null;
  /** Provider that served — or would have served — it, or `null` on a refusal. */
  provider: string | null;
  outcome: AiRequestOutcome;
  /** Normalized failure code, when the request did not produce a normal answer. */
  code?: string;
  /** Lifecycle phase where the request finished or halted. */
  stage?: AiRequestStage;
  /** Specific cause for cancellation, rejection, or abnormal termination. */
  reason?: AiRequestReason;
  /**
   * Safe operational explanation, truncated to at most 256 chars. Never user content.
   */
  message?: string;
  retryAfterSeconds?: number;
  /** Time to the first provider event. Absent when no event ever arrived. */
  firstEventMs?: number;
  /** How long the request took, whatever it did. */
  durationMs: number;
  /** SSE token chunks relayed to the client. Zero on a 200 that produced no text at all. */
  emittedTokenChunks: number;
  /** The provider's own accounting, when it reported any. */
  usage?: AiTokenUsage;
}

/**
 * Level per outcome, so a record is as visible as it deserves to be in `wrangler tail`.
 *
 * `aborted` is deliberately not a warning and certainly not an error: a user pressing Stop must not
 * read as a fault in the logs, or the failure rate becomes meaningless. A **refusal** is a warning
 * because it means the deployment is configured to turn requests away, which someone should notice.
 */
const LOG_LEVEL: Record<AiRequestOutcome, 'info' | 'warn' | 'error'> = {
  ok: 'info',
  aborted: 'info',
  rejected: 'warn',
  error: 'error',
};

/**
 * Resolves the appropriate log level for a telemetry record.
 * Expected platform throttling on shared endpoints (RATE_LIMITED) is logged at 'warn' rather
 * than 'error' to prevent false infrastructure alert spikes.
 */
export function resolveTelemetryLogLevel(record: AiRequestTelemetry): 'info' | 'warn' | 'error' {
  if (record.code === 'RATE_LIMITED') return 'warn';
  return LOG_LEVEL[record.outcome];
}

/**
 * Builds the record's logged shape. Pure, so the shape is asserted without touching console.
 *
 * Tagged with `event` so every AI record can be filtered as one series regardless of outcome.
 */
export function buildAiRequestTelemetry(
  record: AiRequestTelemetry,
): { event: 'ai.chat' } & AiRequestTelemetry {
  const sanitizedMessage = sanitizeTelemetryMessage(record.message);

  const built: { event: 'ai.chat' } & AiRequestTelemetry = {
    event: 'ai.chat' as const,
    ...record,
    ...(sanitizedMessage !== undefined ? { message: sanitizedMessage } : {}),
  };

  // Keys the caller left `undefined` are dropped rather than logged: "the provider reported nothing"
  // and "the provider reported zero" are different findings, and an indexed `usage: null` column
  // would blur them. Only top-level keys are filtered — the nested usage object is already absent or
  // complete.
  return Object.fromEntries(
    Object.entries(built).filter(([, value]) => value !== undefined),
  ) as unknown as { event: 'ai.chat' } & AiRequestTelemetry;
}

/**
 * Emits one record at the level its outcome deserves.
 *
 * The **object** is handed to `console`, never a pre-stringified line: Workers Logs extracts and
 * indexes fields from a logged object, so `outcome`, `model`, and `code` become filterable columns —
 * which is what turns "how often is MAX rate-limited" into a query instead of a text search through
 * a `wrangler tail` session.
 */
export function logAiRequestTelemetry(record: AiRequestTelemetry): void {
  try {
    const line = buildAiRequestTelemetry(record);
    const level = resolveTelemetryLogLevel(record);

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  } catch {
    try {
      console.warn('Failed to emit AI request telemetry');
    } catch {
      // Fail-safe: telemetry logging must never throw or disrupt response streaming.
    }
  }
}
