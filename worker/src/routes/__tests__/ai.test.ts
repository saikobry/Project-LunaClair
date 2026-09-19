import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleAiChat, handleAiModels } from '../ai';
import type { Env, RouteContext } from '../../core/types';

const DEFAULT_PROVIDER_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_CATALOG_ID = 'cf-llama-3.3-70b';

/** A Workers AI style stream: a text chunk carrying usage on its terminal payload. */
function workersAiStream(text = 'Hello', usage = '{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}') {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: {"response":"${text}","usage":${usage}}\n\n`));
      controller.close();
    },
  });
}

const UKISAI_BASE_URL = 'https://ukisai.test/v1';

/** An OpenAI-shaped stream: content deltas, a reasoning delta to discard, then usage. */
function ukisaiStream() {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const payloads = [
        '{"choices":[{"delta":{"content":"Hello"}}]}',
        // Thinking is disabled, but a reasoning delta must never leak into the transcript.
        '{"choices":[{"delta":{"reasoning_content":"weighing options"}}]}',
        '{"choices":[],"usage":{"prompt_tokens":11,"completion_tokens":4,"total_tokens":15}}',
        '[DONE]',
      ];
      for (const payload of payloads) controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      controller.close();
    },
  });
}

function makeCtx(
  body: unknown,
  run?: (model: string, inputs: Record<string, unknown>) => Promise<unknown>,
): RouteContext {
  const env = {
    DB: {} as unknown as D1Database,
    AI: run ? { run: vi.fn(run) } : undefined,
    UKISAI_BASE_URL,
  } as unknown as Env;

  return {
    request: new Request('https://api.test/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    url: new URL('https://api.test/api/ai/chat'),
    params: {},
    corsHeaders: {},
  };
}

/** Parses the app-native SSE events out of a chat response body. */
async function readEvents(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text();
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
}

describe('handleAiModels', () => {
  it('serves the public catalog', async () => {
    const response = handleAiModels(makeCtx({}));

    expect(response.status).toBe(200);
    const catalog = (await response.json()) as { defaultModelId: string; models: unknown[] };
    expect(catalog.defaultModelId).toBe(DEFAULT_CATALOG_ID);
    expect(catalog.models.length).toBeGreaterThan(0);
  });
});

describe('handleAiChat model resolution', () => {
  it('serves the default model when the request names none', async () => {
    const run = vi.fn(async () => workersAiStream());
    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, run),
    );

    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith(
      DEFAULT_PROVIDER_MODEL,
      expect.objectContaining({ stream: true, max_tokens: 4_096 }),
    );
  });

  it('resolves a named catalog model to its provider model id', async () => {
    const run = vi.fn(async () => workersAiStream());
    await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: DEFAULT_CATALOG_ID }, run),
    );

    expect(run).toHaveBeenCalledWith(DEFAULT_PROVIDER_MODEL, expect.anything());
  });

  it('refuses an unknown model instead of silently serving the default', async () => {
    const run = vi.fn(async () => workersAiStream());
    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'nope' }, run),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'MODEL_UNAVAILABLE' });
    expect(run).not.toHaveBeenCalled();
  });

  it('fails a Workers AI model when the binding is not configured', async () => {
    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: DEFAULT_CATALOG_ID }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });

  it('reports the app-facing model id on the terminal event', async () => {
    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, async () => workersAiStream()),
    );
    const events = await readEvents(response);

    expect(events.at(-1)).toMatchObject({ type: 'done', model: DEFAULT_CATALOG_ID });
  });

  it('bounds the study material by the served model document budget', async () => {
    const run = vi.fn(async () => workersAiStream());
    await handleAiChat(
      makeCtx(
        {
          messages: [{ role: 'user', content: 'hi' }],
          documentContext: { title: 'Big', markdown: 'x'.repeat(40_000) },
        },
        run,
      ),
    );

    const calls = run.mock.calls as unknown as Array<
      [string, { messages: Array<{ content: string }> }]
    >;
    const [providerModel, inputs] = calls[0];
    // 16,000 characters of material plus framing, never the full 40,000.
    expect(providerModel).toBe(DEFAULT_PROVIDER_MODEL);
    expect(inputs.messages[0].content.length).toBeLessThan(20_000);
    expect(inputs.messages[0].content).toContain('--- END OF STUDY MATERIAL ---');
  });
});

describe('handleAiChat provider dispatch', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('serves MAX through the UkisAI provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: ukisaiStream(),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${UKISAI_BASE_URL}/chat/completions`,
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const sent = JSON.parse(init.body) as Record<string, unknown>;
    expect(sent.model).toBe('swift');
    expect(sent.stream).toBe(true);
    expect(sent.stream_options).toEqual({ include_usage: true });
    // Thinking would consume max_tokens before the answer and can leave the content empty.
    expect(sent.chat_template_kwargs).toEqual({ enable_thinking: false });

    const events = await readEvents(response);
    expect(events.filter((event) => event.type === 'token')).toEqual([
      { type: 'token', text: 'Hello' },
    ]);
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      usage: { promptTokens: 11, completionTokens: 4, totalTokens: 15 },
      model: 'ukisai-swift-max',
    });
    // A reasoning delta is parsed and discarded, never emitted as answer text.
    expect(JSON.stringify(events)).not.toContain('weighing options');
  });

  it('reports a provider rate limit with the wait the provider named', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: {
          message: 'Rate limit: 5 prompts per minute per IP. Try again in 7s.',
          type: 'rate_limit',
        },
      }),
    } as unknown as Response);

    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }),
    );

    // A pre-stream failure keeps its own status and code rather than becoming a 200 with an error body.
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 7 });
  });
});

describe('handleAiChat failures', () => {
  it('fails when the Workers AI binding is absent', async () => {
    const response = await handleAiChat(makeCtx({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });

  it('maps a context rejection to CONTEXT_LIMIT', async () => {
    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, async () => {
        throw new Error(
          '5021: The estimated number of input and maximum output tokens (8810) exceeded this model context window limit (8192)',
        );
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'CONTEXT_LIMIT' });
  });

  it('maps a provider rate limit to RATE_LIMITED', async () => {
    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, async () => {
        throw new Error('Rate limit: 5 prompts per minute per IP.');
      }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps anything else to UPSTREAM_ERROR rather than a bare 500', async () => {
    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, async () => {
        throw new Error('socket hang up');
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'UPSTREAM_ERROR' });
  });

  it('rejects a request with no messages', async () => {
    const response = await handleAiChat(makeCtx({ messages: [] }, async () => workersAiStream()));

    expect(response.status).toBe(400);
  });
});
