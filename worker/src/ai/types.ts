import type { AiTokenUsage } from '../core/aiUsage';
import type { AiProviderId } from '../core/aiModels';

/**
 * The Worker's internal provider boundary.
 *
 * `/api/ai/chat` composes the prompt, resolves the model, and frames the SSE response; a provider's
 * only job is to invoke one vendor's model and yield **normalized** events. Every vendor payload
 * shape, authentication rule, and error format lives behind this interface, so adding a provider
 * never reaches into the route and the route never learns a vendor's vocabulary.
 *
 * This is deliberately not exported from the Worker's public surface: the client names an app-facing
 * model id and never a provider.
 */

/** Normalized failure codes, carried through to the client's coded error response. */
export type AiErrorCode = 'RATE_LIMITED' | 'CONTEXT_LIMIT' | 'UPSTREAM_ERROR';

/**
 * A provider failure, already classified.
 *
 * Providers throw this so the route can map a cause to a status without parsing messages it does
 * not own. `retryAfterSeconds` is populated when the provider states a wait (e.g. a 429 body).
 */
export class AiProviderError extends Error {
  code: AiErrorCode;
  retryAfterSeconds?: number;

  constructor(message: string, code: AiErrorCode, retryAfterSeconds?: number) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * What a provider yields.
 *
 * Generation text and metering are separated on purpose: `done` on the wire needs one model id and
 * one usage report, and only the provider knows when its stream has finished accounting.
 */
export type AiProviderEvent =
  | { type: 'token'; text: string }
  | { type: 'usage'; usage: AiTokenUsage };

export interface AiProviderRequest {
  /** The **provider's** model id, already resolved from the catalog. */
  modelId: string;
  messages: Array<{ role: string; content: string }>;
  maxOutputTokens: number;
  temperature: number;
  /** Aborts the outbound provider request when the client disconnects. */
  signal?: AbortSignal;
}

export interface AiProvider {
  readonly id: AiProviderId;
  /** Yields normalized events; throws `AiProviderError` for anything the caller must report. */
  stream(request: AiProviderRequest): AsyncIterable<AiProviderEvent>;
}
