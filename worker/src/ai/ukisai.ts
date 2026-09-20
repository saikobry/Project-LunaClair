import { readAiTokenUsage } from '../core/aiUsage';
import { createTimeoutSignal } from './deadline';
import { toAiProviderError } from './errors';
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
 * The deadline covers **becoming responsive**, not the whole answer: the composed signal is dropped
 * once the response headers arrive, and the route's idle deadline governs the body from there. A
 * below-SLA research endpoint that accepts a request and then never answers is the failure this
 * prevents, and it was reachable before this existed.
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
      request.timeoutMs,
      `UkisAI did not respond within ${request.timeoutMs}ms.`,
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
          `UkisAI did not respond within ${request.timeoutMs}ms.`,
          'TIMEOUT',
        );
      }
      if (request.signal?.aborted) {
        throw new AiProviderError('The AI request was cancelled.', 'ABORTED');
      }
      throw toAiProviderError(err, 'UkisAI request failed');
    } finally {
      // Headers are in (or the request already failed): the connect deadline has done its job.
      deadline.clear();
    }

    if (!response.ok) {
      throw await classifyFailure(response);
    }
    if (!response.body) {
      throw new AiProviderError('UkisAI returned no response body', 'UPSTREAM_ERROR');
    }

    for await (const payload of readSseData(response.body)) {
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
 * The endpoint answers with an OpenAI-shaped `{ error: { message, type } }`; the message is what
 * carries the retry hint on a 429 and the token accounting on an over-length request, so it is read
 * and forwarded rather than replaced with a generic string.
 */
async function classifyFailure(response: Response): Promise<AiProviderError> {
  let message = `HTTP ${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as { error?: { message?: unknown } | string };
    const detail = typeof body.error === 'string' ? body.error : body.error?.message;
    if (typeof detail === 'string' && detail) message = detail;
  } catch {
    // Non-JSON error body: the status text stands in.
  }

  const lower = message.toLowerCase();
  if (response.status === 429 || lower.includes('rate limit')) {
    const hinted = RETRY_HINT_PATTERN.exec(message);
    return new AiProviderError(
      message,
      'RATE_LIMITED',
      hinted ? Number.parseInt(hinted[1], 10) : undefined,
    );
  }
  if (lower.includes('context') || lower.includes('too long') || lower.includes('max_tokens')) {
    return new AiProviderError(message, 'CONTEXT_LIMIT');
  }
  return new AiProviderError(message, 'UPSTREAM_ERROR');
}
