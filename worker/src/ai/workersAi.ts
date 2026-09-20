import { readAiTokenUsage } from '../core/aiUsage';
import type { AiBinding } from '../core/types';
import { readSseData } from './sse';
import { toAiProviderError } from './errors';
import { AiProviderError, type AiProvider, type AiProviderEvent, type AiProviderRequest } from './types';

/**
 * Cloudflare Workers AI, via the native platform binding.
 *
 * `env.AI.run` is an in-process binding rather than an HTTP endpoint: there is no URL and no API
 * key, and the binding itself is the credential. That is why this provider holds a binding instead
 * of a base URL.
 *
 * Leniency is deliberate: a payload carrying neither text nor usage is logged and skipped rather
 * than thrown, because Cloudflare attaches usage to the terminal chunk only and a run that yields
 * nothing must still reach a `done` event the client can act on.
 */
export class WorkersAiProvider implements AiProvider {
  readonly id = 'workers-ai' as const;
  private readonly binding: AiBinding;

  constructor(binding: AiBinding) {
    this.binding = binding;
  }

  async *stream(request: AiProviderRequest): AsyncIterable<AiProviderEvent> {
    let response: unknown;
    try {
      response = await this.binding.run(request.modelId, {
        messages: request.messages,
        stream: true,
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature,
      });
    } catch (err: unknown) {
      // Cloudflare reports context rejections and rate limits as thrown errors. The shared
      // classifier reads a declared status/code when the thrown value carries one (including the
      // numeric platform code that prefixes the message), and only then falls back to prose — so a
      // blanket UPSTREAM_ERROR is never the answer when the cause is knowable.
      throw toAiProviderError(err, 'Workers AI invocation failed');
    }

    if (!(response instanceof ReadableStream)) {
      throw new AiProviderError('Workers AI returned no stream', 'UPSTREAM_ERROR');
    }

    let unexpectedSample: string | undefined;

    for await (const payload of readSseData(response as ReadableStream<Uint8Array>)) {
      if (payload === '[DONE]') return;

      let parsed: { response?: unknown; usage?: unknown };
      try {
        parsed = JSON.parse(payload) as { response?: unknown; usage?: unknown };
      } catch {
        continue; // Malformed payload: nothing usable to report.
      }

      // A later usage report supersedes an earlier one.
      const usage = readAiTokenUsage(parsed.usage);
      if (usage) yield { type: 'usage', usage };

      if (typeof parsed.response === 'string' && parsed.response.length > 0) {
        yield { type: 'token', text: parsed.response };
      } else if (!usage && unexpectedSample === undefined) {
        // Shape this provider does not understand — most likely an error object, which would
        // otherwise be discarded without trace.
        unexpectedSample = payload.slice(0, 300);
      }
    }

    if (unexpectedSample !== undefined) {
      console.warn('Workers AI sent a payload this endpoint does not understand', {
        model: request.modelId,
        sample: unexpectedSample,
      });
    }
  }
}
