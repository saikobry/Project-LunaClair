import { readAiTokenUsage } from '../core/aiUsage';
import { createTimeoutSignal } from './deadline';
import { classifyAiFailure, toAiProviderError, type AiFailureSignal } from './errors';
import { readSseData } from './sse';
import { AiProviderError, type AiProvider, type AiProviderEvent, type AiProviderRequest } from './types';

/** Overridable for local dev; the hosted research endpoint is the default. */
export const UKISAI_DEFAULT_BASE_URL = 'https://ukisai.com/api/swift/v1';

/** Matches the provider's own "Try again in 7s." phrasing so the wait the UI shows is its number. */
const RETRY_HINT_PATTERN = /try again in (\d+)\s*s/i;

/**
 * UkisAI's hosted Swift model (`ukisai/Swift-Qwen3.8-27b`), served through an OpenAI-compatible API.
 *
 * Three provider-specific facts shape this adapter, all verified against the live endpoint:
 *
 * 1. **No credential.** The API is keyless for research use, so there is no secret to hold and a
 *    leaked-key failure mode does not exist here. The cost of that is shared capacity: the endpoint
 *    allows ~5 prompts/minute per IP, and every user of this Worker shares one egress IP.
 * 2. **Thinking is on by default** (Qwen3). `enable_thinking: false` keeps the assistant's visible
 *    answer free of reasoning traces and, more importantly, keeps `max_tokens` from being consumed
 *    by reasoning — a small `max_tokens` with thinking on returns `finish_reason: "length"` and
 *    **empty content**. Reasoning is still *parsed* (`delta.reasoning_content`) and discarded rather
 *    than assumed absent, so a provider-side default change degrades into ignored text, not garbage
 *    in the transcript.
 * 3. **In-band usage.** `stream_options: { include_usage: true }` makes the terminal chunk carry
 *    the same snake_case counters Workers AI reports, so `readAiTokenUsage` normalizes both.
 *
 * The endpoint sends no `Access-Control-Allow-Origin`, so this is reachable only from the Worker —
 * which the architecture already required.
 *
 * The connect deadline covers **becoming responsive**, not the whole answer: only the connect timer
 * is cleared once headers arrive, while `request.signal` — owned by the route — stays attached to the
 * body for the rest of the stream. A below-SLA research endpoint that accepts a request and then
 * never answers is the failure the connect deadline prevents; a body that stalls mid-answer is the
 * route's idle deadline to cancel, and cancelling it is what tears this fetch down.
 */
export class UkisAiProvider implements AiProvider {
  readonly id = 'ukisai' as const;
  private readonly baseUrl: string;

  constructor(baseUrl: string = UKISAI_DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async *stream(request: AiProviderRequest): AsyncIterable<AiProviderEvent> {
    const deadline = createTimeoutSignal(
      request.signal,
      request.connectTimeoutMs,
      `UkisAI did not respond within ${request.connectTimeoutMs}ms.`,
    );

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          model: request.modelId,
          messages: request.messages,
          stream: true,
          max_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          stream_options: { include_usage: true },
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal: deadline.signal,
      });
    } catch (err: unknown) {
      // Timeout and client abort are separated on purpose: one is the provider's fault and must be
      // retryable, the other is the user's Stop and must not be reported as a failure at all.
      if (deadline.timedOut()) {
        throw new AiProviderError(
          `UkisAI did not respond within ${request.connectTimeoutMs}ms.`,
          'TIMEOUT',
        );
      }
      if (request.signal?.aborted) {
        throw new AiProviderError('The AI request was cancelled.', 'ABORTED');
      }
      throw toAiProviderError(err, 'UkisAI request failed');
    } finally {
      // Headers are in (or the request already failed): the connect deadline has done its job. Only
      // the timer and its listener go — `request.signal` remains the body's cancellation channel.
      deadline.clear();
    }

    if (!response.ok) {
      throw await classifyFailure(response);
    }
    if (!response.body) {
      throw new AiProviderError('UkisAI returned no response body', 'UPSTREAM_ERROR');
    }

    for await (const payload of readSseData(response.body, request.signal)) {
      if (payload === '[DONE]') return;

      let parsed: {
        choices?: Array<{ delta?: { content?: unknown; reasoning_content?: unknown } }>;
        usage?: unknown;
      };
      try {
        parsed = JSON.parse(payload) as typeof parsed;
      } catch {
        continue;
      }

      const usage = readAiTokenUsage(parsed.usage);
      if (usage) yield { type: 'usage', usage };

      // `reasoning_content` is read and dropped: never mixed into the answer, never mistaken for it.
      const content = parsed.choices?.[0]?.delta?.content;
      if (typeof content === 'string' && content.length > 0) {
        yield { type: 'token', text: content };
      }
    }
  }
}

/**
 * Maps a non-OK response onto a coded failure.
 *
 * Classification trusts what the response *declares* — its status, its `Retry-After` header, and the
 * OpenAI-shaped `{ error: { message, type, code } }` fields — and reads the message only to keep the
 * human-readable detail (and, failing everything else, to guess the cause). The message is forwarded
 * rather than replaced, because it carries the token accounting on an over-length request.
 */
async function classifyFailure(response: Response): Promise<AiProviderError> {
  let message = `HTTP ${response.status} ${response.statusText}`;
  const signal: AiFailureSignal = { status: response.status };
  try {
    const body = (await response.json()) as {
      error?: { message?: unknown; type?: unknown; code?: unknown } | string;
    };
    const error = body.error;
    if (typeof error === 'string') {
      message = error;
    } else {
      if (typeof error?.message === 'string' && error.message) message = error.message;
      if (typeof error?.type === 'string') signal.type = error.type;
      if (typeof error?.code === 'string' || typeof error?.code === 'number') {
        signal.code = error.code;
      }
    }
  } catch {
    // Non-JSON error body: the status text stands in.
  }

  const code = classifyAiFailure(message, signal);
  if (code !== 'RATE_LIMITED') return new AiProviderError(message, code);

  // The header is the structured form of the wait; the message hint is what this host actually
  // sends today, so it stays as the fallback rather than being replaced by it.
  return new AiProviderError(message, 'RATE_LIMITED', readRetryAfterSeconds(response, message));
}

/** Seconds to wait: the `Retry-After` header when present, else the provider's "Try again in Ns." */
function readRetryAfterSeconds(response: Response, message: string): number | undefined {
  const header = response.headers?.get('retry-after');
  if (header) {
    const seconds = Number.parseInt(header, 10);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds;
    // A date-form header is legal HTTP; anything unparseable falls through to the message.
  }

  const hinted = RETRY_HINT_PATTERN.exec(message);
  return hinted ? Number.parseInt(hinted[1], 10) : undefined;
}
