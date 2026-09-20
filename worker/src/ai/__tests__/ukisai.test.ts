import { afterEach, describe, expect, it, vi } from 'vitest';
import { UkisAiProvider } from '../ukisai';
import { AiProviderError } from '../types';

const BASE_URL = 'https://ukisai.test/v1';

function sseStream(payloads: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const payload of payloads) controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      controller.close();
    },
  });
}

async function collect(provider: UkisAiProvider, modelId = 'swift') {
  const events = [];
  for await (const event of provider.stream({
    modelId,
    messages: [{ role: 'user', content: 'hi' }],
    maxOutputTokens: 4_096,
    temperature: 0.5,
    connectTimeoutMs: 60_000,
    signal: new AbortController().signal,
  })) {
    events.push(event);
  }
  return events;
}

describe('UkisAiProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('asks for a streamed, accounting-enabled, thinking-off completion', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body: sseStream(['[DONE]']) });
    globalThis.fetch = fetchMock;

    await collect(new UkisAiProvider(BASE_URL), 'swift');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe(`${BASE_URL}/chat/completions`);
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'swift',
      stream: true,
      max_tokens: 4_096,
      stream_options: { include_usage: true },
      chat_template_kwargs: { enable_thinking: false },
    });
  });

  it('normalizes content deltas into tokens and usage into a usage event', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseStream([
        '{"choices":[{"delta":{"content":"Hello"}}]}',
        '{"choices":[{"delta":{"content":" there"}}]}',
        '{"choices":[],"usage":{"prompt_tokens":9,"completion_tokens":2,"total_tokens":11}}',
        '[DONE]',
      ]),
    } as unknown as Response);

    expect(await collect(new UkisAiProvider(BASE_URL))).toEqual([
      { type: 'token', text: 'Hello' },
      { type: 'token', text: ' there' },
      { type: 'usage', usage: { promptTokens: 9, completionTokens: 2, totalTokens: 11 } },
    ]);
  });

  it('discards reasoning deltas instead of emitting them as answer text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseStream([
        '{"choices":[{"delta":{"reasoning_content":"silent deliberation"}}]}',
        '{"choices":[{"delta":{"content":"Answer"}}]}',
      ]),
    } as unknown as Response);

    expect(await collect(new UkisAiProvider(BASE_URL))).toEqual([{ type: 'token', text: 'Answer' }]);
  });

  it('skips malformed payloads rather than failing the stream', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseStream(['{not json', '{"choices":[{"delta":{"content":"ok"}}]}']),
    } as unknown as Response);

    expect(await collect(new UkisAiProvider(BASE_URL))).toEqual([{ type: 'token', text: 'ok' }]);
  });

  it('classifies a 429 as RATE_LIMITED and carries the provider wait', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: { message: 'Rate limit: 5 prompts per minute per IP. Try again in 7s.' },
      }),
    } as unknown as Response);

    const error = await collect(new UkisAiProvider(BASE_URL)).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 7 });
  });

  it('prefers the Retry-After header over the prose hint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: { get: (name: string) => (name === 'retry-after' ? '3' : null) },
      json: async () => ({
        error: { message: 'Rate limit: 5 prompts per minute per IP. Try again in 7s.' },
      }),
    } as unknown as Response);

    // The header is the structured form of the same fact, so it wins over the message.
    await expect(collect(new UkisAiProvider(BASE_URL))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 3,
    });
  });

  it('classifies a declared error type without reading the message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: { message: 'Request rejected.', type: 'context_length_exceeded' },
      }),
    } as unknown as Response);

    await expect(collect(new UkisAiProvider(BASE_URL))).rejects.toMatchObject({
      code: 'CONTEXT_LIMIT',
    });
  });

  it('classifies a length rejection as CONTEXT_LIMIT', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: { message: 'This model maximum context length is 8192 tokens.' },
      }),
    } as unknown as Response);

    await expect(collect(new UkisAiProvider(BASE_URL))).rejects.toMatchObject({
      code: 'CONTEXT_LIMIT',
    });
  });

  it('classifies an unrecognized failure as UPSTREAM_ERROR and keeps the provider message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: { message: 'upstream exploded' } }),
    } as unknown as Response);

    await expect(collect(new UkisAiProvider(BASE_URL))).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      message: 'upstream exploded',
    });
  });

  it('falls back to the status text when the error body is not JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    await expect(collect(new UkisAiProvider(BASE_URL))).rejects.toMatchObject({
      message: 'HTTP 502 Bad Gateway',
    });
  });

  it('abandons a request that never becomes responsive as TIMEOUT', async () => {
    vi.useFakeTimers();
    try {
      // A host below SLA can accept the connection and then send nothing at all.
      globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason ?? new Error('aborted')),
          );
        });
      }) as unknown as typeof fetch;

      const streamed = collect(new UkisAiProvider(BASE_URL));
      const settled = expect(streamed).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(60_000);

      await settled;
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a caller cancellation as ABORTED, not as an upstream failure', async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason ?? new Error('aborted')),
        );
        controller.abort();
      });
    }) as unknown as typeof fetch;

    const events: unknown[] = [];
    const streamed = (async () => {
      for await (const event of new UkisAiProvider(BASE_URL).stream({
        modelId: 'swift',
        messages: [{ role: 'user', content: 'hi' }],
        maxOutputTokens: 4_096,
        temperature: 0.5,
        connectTimeoutMs: 60_000,
        signal: controller.signal,
      })) {
        events.push(event);
      }
    })();

    await expect(streamed).rejects.toMatchObject({ code: 'ABORTED' });
    expect(events).toEqual([]);
  });
});
