import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleAiChat, handleAiModels } from '../ai';
import { AI_FIRST_EVENT_TIMEOUT_MS, AI_STREAM_IDLE_TIMEOUT_MS } from '../../ai/deadline';
import type { Env, RouteContext } from '../../core/types';
import * as providersModule from '../../ai/providers';
import type { AiProvider, AiProviderEvent } from '../../ai/types';

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
  envOverrides: Partial<Env> = {},
): RouteContext {
  const env = {
    DB: {} as unknown as D1Database,
    AI: run ? { run: vi.fn(run) } : undefined,
    UKISAI_BASE_URL,
    ...envOverrides,
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

/**
 * An OpenAI-shaped stream that emits one token and then never ends.
 *
 * Its `cancel` handler is spy-able on purpose: "was the pull actually cancelled?" is otherwise
 * invisible from the outside, and an abandoned read that stays parked is exactly the leak the route
 * now has to prevent.
 */
function stalledUkisaiStream(): { body: ReadableStream<Uint8Array>; wasCancelled: () => boolean } {
  const encoder = new TextEncoder();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
    },
    cancel() {
      cancelled = true;
    },
  });
  return { body, wasCancelled: () => cancelled };
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

/**
 * Captures every console channel for one test and exposes the parsed AI telemetry records.
 *
 * Records are read back off the console rather than through a seam, because "what actually reaches
 * the logs" is the thing being asserted — and the level it lands on is part of the contract.
 */
function captureTelemetry() {
  const written: unknown[] = [];
  const spies = (['log', 'warn', 'error'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      written.push(args[0]);
    }),
  );

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && (value as { event?: unknown }).event === 'ai.chat';

  return {
    records: () => written.filter(isRecord),
    /** Anything that is not a telemetry record, i.e. some other logging this test must not see. */
    otherLines: () => written.filter((value) => !isRecord(value)).map((value) => String(value)),
    restore: () => spies.forEach((spy) => spy.mockRestore()),
  };
}

describe('handleAiModels', () => {
  it('serves the public catalog', async () => {
    const response = handleAiModels(makeCtx({}));

    expect(response.status).toBe(200);
    const catalog = (await response.json()) as { defaultModelId: string; models: unknown[] };
    expect(catalog.defaultModelId).toBe(DEFAULT_CATALOG_ID);
    expect(catalog.models.length).toBeGreaterThan(0);
  });

  it('drops a killed model from the catalog, so the picker cannot offer it', async () => {
    const response = handleAiModels(makeCtx({}, undefined, { AI_DISABLED_MODELS: 'ukisai-swift-max' }));
    const catalog = (await response.json()) as { models: Array<{ id: string }> };

    expect(catalog.models.map((model) => model.id)).toEqual([DEFAULT_CATALOG_ID]);
  });

  it('reports the whole assistant as disabled instead of lying with an empty list', async () => {
    const response = handleAiModels(makeCtx({}, undefined, { AI_CHAT_DISABLED: 'true' }));
    const catalog = (await response.json()) as { availability: string; models: unknown[] };

    expect(response.status).toBe(200);
    expect(catalog.availability).toBe('disabled');
    expect(catalog.models).toEqual([]);
  });
});

describe('handleAiChat global shutdown', () => {
  it('refuses every model, including the default, before it looks at the request', async () => {
    const run = vi.fn(async () => workersAiStream());
    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, run, { AI_CHAT_DISABLED: 'true' }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'AI_DISABLED' });
    // The point of the global switch: it can stop the assistant during an incident even when the
    // request names the default, which a per-model switch could not.
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses a malformed body too, because it stops before parsing', async () => {
    const response = await handleAiChat(
      makeCtx('not-an-object', undefined, { AI_CHAT_DISABLED: '1' }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'AI_DISABLED' });
  });
});

describe('handleAiChat operational kill switch', () => {
  it('refuses a model the kill switch disabled, without serving anything else', async () => {
    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }, undefined, {
        AI_DISABLED_MODELS: 'ukisai-swift-max',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'MODEL_UNAVAILABLE' });
  });

  it('still serves the default model while the switch names another one', async () => {
    const run = vi.fn(async () => workersAiStream());
    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, run, {
        AI_DISABLED_MODELS: 'ukisai-swift-max',
      }),
    );

    expect(response.status).toBe(200);
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

  it('abandons a provider that accepts the request and then never yields', async () => {
    vi.useFakeTimers();
    try {
      const response = handleAiChat(
        makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, () => new Promise(() => {})),
      );

      await vi.advanceTimersByTimeAsync(AI_STREAM_IDLE_TIMEOUT_MS);
      const settled = await response;

      // Without the deadline this request would hold the Worker response open indefinitely.
      expect(settled.status).toBe(504);
      expect(await settled.json()).toMatchObject({ code: 'TIMEOUT' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails mid-stream rather than hanging when tokens stop arriving', async () => {
    vi.useFakeTimers();
    try {
      let opened = false;
      const run = async () => {
        const encoder = new TextEncoder();
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"response":"Hello"}\n\n'));
            opened = true;
            // Never closed: the provider went silent after the first token.
          },
        });
      };

      const responsePromise = handleAiChat(
        makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, run),
      );
      const drained = responsePromise.then((response) => readEvents(response));

      // Let the first event commit the 200, then let the idle deadline elapse.
      await vi.advanceTimersByTimeAsync(0);
      expect(opened).toBe(true);
      await vi.advanceTimersByTimeAsync(AI_STREAM_IDLE_TIMEOUT_MS);

      const events = await drained;
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'error', code: 'TIMEOUT' }),
      );
      // The turn is still attributed to the model that served it.
      expect(events.at(-1)).toMatchObject({ type: 'done', model: DEFAULT_CATALOG_ID });
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts the provider request when the first event misses the first-event deadline', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(init.signal?.reason ?? new Error('aborted')),
            );
          }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const settled = handleAiChat(
        makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }),
      );
      await vi.advanceTimersByTimeAsync(AI_FIRST_EVENT_TIMEOUT_MS);
      const response = await settled;

      expect(response.status).toBe(504);
      expect(await response.json()).toMatchObject({ code: 'TIMEOUT' });

      // The signal handed to the provider is the route's, and it is aborted — cancelled, not merely
      // abandoned.
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(init.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a stalled provider stream at the inter-token idle deadline', async () => {
    vi.useFakeTimers();
    try {
      const { body, wasCancelled } = stalledUkisaiStream();
      globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, body })) as unknown as typeof fetch;

      const response = await handleAiChat(
        makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }),
      );
      const drained = readEvents(response);

      await vi.advanceTimersByTimeAsync(AI_STREAM_IDLE_TIMEOUT_MS);
      const events = await drained;

      expect(events).toContainEqual(expect.objectContaining({ type: 'error', code: 'TIMEOUT' }));
      // Still attributed: a turn that consumed tokens is charged to the model that served it.
      expect(events.at(-1)).toMatchObject({ type: 'done', model: 'ukisai-swift-max' });
      await vi.waitFor(() => expect(wasCancelled()).toBe(true));
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels provider work when the client request aborts mid-stream', async () => {
    const { body, wasCancelled } = stalledUkisaiStream();
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, body })) as unknown as typeof fetch;

    const controller = new AbortController();
    const ctx = makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' });
    const response = await handleAiChat({
      ...ctx,
      request: new Request(ctx.request, { signal: controller.signal }),
    });
    expect(response.status).toBe(200);

    controller.abort();

    await vi.waitFor(() => expect(wasCancelled()).toBe(true));
  });

  it('cancels provider work when the response consumer cancels', async () => {
    const { body, wasCancelled } = stalledUkisaiStream();
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, body })) as unknown as typeof fetch;

    const response = await handleAiChat(
      makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }),
    );

    await response.body?.cancel();

    // Nobody is reading any more, so spending the shared provider budget on it is waste.
    await vi.waitFor(() => expect(wasCancelled()).toBe(true));
  });

  it('writes nothing after the client request aborts, and does not report a failure', async () => {
    // The runtime is not required to call the stream's `cancel()` when the request goes away, so the
    // abort handler marks the stream cancelled itself. Without that, a disconnecting client still got
    // an `error` or `done` written into a response nobody was reading.
    const telemetry = captureTelemetry();
    try {
      const { body, wasCancelled } = stalledUkisaiStream();
      globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, body })) as unknown as typeof fetch;

      const controller = new AbortController();
      const ctx = makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' });
      const response = await handleAiChat({
        ...ctx,
        request: new Request(ctx.request, { signal: controller.signal }),
      });
      expect(response.status).toBe(200);

      const reader = response.body?.getReader();
      expect(reader).toBeDefined();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      // One pump owns every read. Racing separate `read()` calls would leave an orphaned pending read
      // behind, and that orphan is what swallows the chunk the assertion is looking for — the test
      // then passes whether or not the write happened.
      void (async () => {
        for (;;) {
          const { value, done } = await reader!.read();
          if (done) return;
          chunks.push(decoder.decode(value));
        }
      })().catch(() => undefined);

      /** Waits until no new chunk has arrived for `quietMs`, so a queued chunk cannot hide a later one. */
      const settle = async (quietMs: number): Promise<void> => {
        let seen = -1;
        let quietSince = Date.now();
        while (Date.now() - quietSince < quietMs) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          if (chunks.length !== seen) {
            seen = chunks.length;
            quietSince = Date.now();
          }
        }
      };

      // Whatever the route had already committed, then abort the way a Stop or a navigation does.
      await settle(30);
      controller.abort();
      await vi.waitFor(() => expect(wasCancelled()).toBe(true));

      // Nothing further is written: the loop exits through the cancelled pull, not through the error
      // path, and the terminal event is skipped because the consumer is gone.
      await settle(60);
      const written = chunks.join('');

      expect(written).toContain('"type":"token"');
      expect(written).not.toContain('"type":"done"');
      expect(written).not.toContain('"type":"error"');

      // Reported once, as a cancellation — not as the provider failure it triggered on the way out,
      // and not at error level.
      expect(telemetry.records()).toEqual([
        expect.objectContaining({ status: 200, outcome: 'aborted', stage: 'mid-stream', reason: 'client-abort' }),
      ]);
      expect(telemetry.otherLines()).toEqual([]);
      await reader!.cancel();
      // First-write-wins: subsequent reader cancel doesn't overwrite client-abort
      expect(telemetry.records()[0]?.reason).toBe('client-abort');
    } finally {
      telemetry.restore();
    }
  });

  it('writes nothing after the consumer cancels, and does not report a failure', async () => {
    const telemetry = captureTelemetry();
    try {
      const { body, wasCancelled } = stalledUkisaiStream();
      globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, body })) as unknown as typeof fetch;

      const response = await handleAiChat(
        makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }),
      );

      await response.body?.cancel();
      await vi.waitFor(() => expect(wasCancelled()).toBe(true));
      // Let the route's stream body settle, so an unguarded enqueue would have thrown by now.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(telemetry.records()).toEqual([
        expect.objectContaining({ status: 200, outcome: 'aborted', stage: 'mid-stream', reason: 'consumer-cancel' }),
      ]);
      expect(telemetry.otherLines()).toEqual([]);
    } finally {
      telemetry.restore();
    }
  });

  it('answers an already-cancelled request without reporting an upstream failure', async () => {
    const telemetry = captureTelemetry();
    try {
      const controller = new AbortController();
      controller.abort();
      const ctx = makeCtx({ messages: [{ role: 'user', content: 'hi' }] });
      const response = await handleAiChat({ ...ctx, request: new Request(ctx.request, { signal: controller.signal }) } as RouteContext);

      expect(response.status).toBe(499);
      expect(telemetry.records()).toEqual([
        expect.objectContaining({ status: 499, outcome: 'aborted', stage: 'pre-stream', reason: 'client-abort' }),
      ]);
    } finally {
      telemetry.restore();
    }
  });

  it('rejects a request with no messages', async () => {
    const response = await handleAiChat(makeCtx({ messages: [] }, async () => workersAiStream()));

    expect(response.status).toBe(400);
  });
});

describe('handleAiChat telemetry', () => {
  it('records the served turn, so latency and cost are measurable at all', async () => {
    const telemetry = captureTelemetry();
    try {
      const run = vi.fn(async () => workersAiStream());
      const response = await handleAiChat(makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, run));
      await readEvents(response);

      const [record] = telemetry.records();
      expect(record).toMatchObject({
        event: 'ai.chat',
        status: 200,
        model: DEFAULT_CATALOG_ID,
        provider: 'workers-ai',
        outcome: 'ok',
        emittedTokenChunks: 1,
        usage: { promptTokens: 5, completionTokens: 2 },
      });
      // Both timings are present and real, which is the whole point of the record.
      expect(typeof record?.firstEventMs).toBe('number');
      expect(typeof record?.durationMs).toBe('number');
    } finally {
      telemetry.restore();
    }
  });

  it('records one line per request, never two', async () => {
    const telemetry = captureTelemetry();
    try {
      const run = vi.fn(async () => workersAiStream());
      await readEvents(await handleAiChat(makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, run)));

      expect(telemetry.records()).toHaveLength(1);
    } finally {
      telemetry.restore();
    }
  });

  it('records a pre-stream failure with the code, the stage, and the provider message', async () => {
    const telemetry = captureTelemetry();
    try {
      await handleAiChat(
        makeCtx({ messages: [{ role: 'user', content: 'hi' }] }, async () => {
          throw new Error(
            '5021: The estimated number of input and maximum output tokens (8810) exceeded this model context window limit (8192)',
          );
        }),
      );

      expect(telemetry.records()).toEqual([
        expect.objectContaining({
          status: 400,
          outcome: 'error',
          stage: 'pre-stream',
          code: 'CONTEXT_LIMIT',
          model: DEFAULT_CATALOG_ID,
          provider: 'workers-ai',
        }),
      ]);
    } finally {
      telemetry.restore();
    }
  });

  it('records a mid-stream failure as its own stage, with what was already delivered', async () => {
    vi.useFakeTimers();
    const telemetry = captureTelemetry();
    try {
      const { body } = stalledUkisaiStream();
      globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, body })) as unknown as typeof fetch;

      const response = await handleAiChat(
        makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }),
      );
      const drained = readEvents(response);
      await vi.advanceTimersByTimeAsync(AI_STREAM_IDLE_TIMEOUT_MS);
      await drained;

      expect(telemetry.records()).toEqual([
        expect.objectContaining({
          status: 200,
          outcome: 'error',
          code: 'TIMEOUT',
          stage: 'mid-stream',
          reason: 'timeout',
          emittedTokenChunks: 1,
        }),
      ]);
    } finally {
      telemetry.restore();
      vi.useRealTimers();
    }
  });

  it('records a policy refusal without any provider work', async () => {
    const telemetry = captureTelemetry();
    try {
      const run = vi.fn(async () => workersAiStream());
      await handleAiChat(
        makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }, run, {
          AI_DISABLED_MODELS: 'ukisai-swift-max',
        }),
      );

      expect(telemetry.records()).toEqual([
        expect.objectContaining({
          status: 400,
          outcome: 'rejected',
          stage: 'pre-stream',
          reason: 'model-disabled',
          code: 'MODEL_UNAVAILABLE',
          model: 'ukisai-swift-max',
          emittedTokenChunks: 0,
        }),
      ]);
      expect(run).not.toHaveBeenCalled();
    } finally {
      telemetry.restore();
    }
  });

  it('records a 200 that produced no text as zero delivered tokens', async () => {
    const telemetry = captureTelemetry();
    try {
      // A stream whose payload carries no text: the case that was previously a one-off warning line
      // nobody could correlate.
      const empty = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"usage":{"total_tokens":7}}\n\n'));
          controller.close();
        },
      });
      globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, body: empty })) as unknown as typeof fetch;

      const response = await handleAiChat(
        makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }),
      );
      await readEvents(response);

      expect(telemetry.records()).toEqual([
        expect.objectContaining({ status: 200, outcome: 'ok', emittedTokenChunks: 0 }),
      ]);
    } finally {
      telemetry.restore();
    }
  });

  it('never writes the prompt, the study material, or the selection to the logs', async () => {
    const telemetry = captureTelemetry();
    const materialMarker = 'STUDY-MATERIAL-MARKER-9f3a';
    const selectionMarker = 'SELECTION-MARKER-71bd';
    const promptMarker = 'PROMPT-MARKER-2c8e';
    try {
      const run = vi.fn(async () => workersAiStream());
      await readEvents(
        await handleAiChat(
          makeCtx(
            {
              messages: [{ role: 'user', content: promptMarker }],
              documentContext: { title: 'Material', markdown: materialMarker },
              selection: { text: selectionMarker },
            },
            run,
          ),
        ),
      );

      // The prompt really did carry all three, so an empty-log pass is not vacuous.
      const [, inputs] = run.mock.calls[0] as unknown as [string, { messages: Array<{ content: string }> }];
      const sent = inputs.messages.map((message) => message.content).join('\n');
      expect(sent).toContain(materialMarker);
      expect(sent).toContain(selectionMarker);
      expect(sent).toContain(promptMarker);

      // ...and none of it reached the logs, at any level.
      const everyLine = [...telemetry.records().map((record) => JSON.stringify(record)), ...telemetry.otherLines()].join('\n');
      expect(everyLine).not.toContain(materialMarker);
      expect(everyLine).not.toContain(selectionMarker);
      expect(everyLine).not.toContain(promptMarker);
    } finally {
      telemetry.restore();
    }
  });

  it('uses the exact active iterator and does not re-acquire it from an AsyncIterable', async () => {
    let iteratorsCreated = 0;
    const customEvents: AsyncIterable<AiProviderEvent> = {
      [Symbol.asyncIterator]() {
        iteratorsCreated++;
        return (async function* () {
          yield { type: 'token' as const, text: 'hi' };
        })();
      },
    };

    const mockProvider: AiProvider = {
      id: 'ukisai',
      stream: vi.fn(() => customEvents),
    };
    const spy = vi.spyOn(providersModule, 'resolveAiProvider').mockReturnValue(mockProvider);

    try {
      const response = await handleAiChat(
        makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' }),
      );
      await readEvents(response);

      // Must only have acquired the iterator once
      expect(iteratorsCreated).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('does not hang stream shutdown when iterator.return() returns a promise that never resolves', async () => {
    let returnCalled = false;
    async function* hangingStream(): AsyncGenerator<AiProviderEvent, void, void> {
      yield { type: 'token', text: 'hello' };
      await new Promise(() => {}); // hang forever
    }
    const iter = hangingStream();
    iter.return = () => {
      returnCalled = true;
      return new Promise<IteratorResult<AiProviderEvent, void>>(() => {});
    };

    const customEvents: AsyncIterable<AiProviderEvent> = {
      [Symbol.asyncIterator]: () => iter,
    };
    const mockProvider: AiProvider = {
      id: 'ukisai',
      stream: vi.fn(() => customEvents),
    };
    const spy = vi.spyOn(providersModule, 'resolveAiProvider').mockReturnValue(mockProvider);

    try {
      const controller = new AbortController();
      const ctx = makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' });
      const response = await handleAiChat({
        ...ctx,
        request: new Request(ctx.request, { signal: controller.signal }),
      });

      const reader = response.body?.getReader();
      await reader?.read();
      controller.abort();
      await reader?.cancel();

      expect(returnCalled).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('terminates pull loop immediately when enqueue fails', async () => {
    let pulledCount = 0;
    async function* endlessStream(): AsyncGenerator<AiProviderEvent, void, void> {
      while (true) {
        pulledCount++;
        yield { type: 'token', text: `chunk-${pulledCount}` };
      }
    }

    const customEvents: AsyncIterable<AiProviderEvent> = {
      [Symbol.asyncIterator]: () => endlessStream(),
    };
    const mockProvider: AiProvider = {
      id: 'ukisai',
      stream: vi.fn(() => customEvents),
    };
    const spy = vi.spyOn(providersModule, 'resolveAiProvider').mockReturnValue(mockProvider);

    try {
      const ctx = makeCtx({ messages: [{ role: 'user', content: 'hi' }], model: 'ukisai-swift-max' });
      const response = await handleAiChat(ctx);
      const reader = response.body?.getReader();
      await reader?.read();
      await reader?.cancel();

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(pulledCount).toBeLessThanOrEqual(3);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('handleAiChat multimodal vision', () => {
  const sampleValidJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  it('rejects image requests if model does not support vision', async () => {
    const telemetry = captureTelemetry();
    try {
      const response = await handleAiChat(
        makeCtx({
          model: 'cf-llama-3.3-70b',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Transcribe this' },
                { type: 'image_url', image_url: { url: sampleValidJpeg } },
              ],
            },
          ],
        }),
      );

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchObject({
        code: 'MODEL_UNAVAILABLE',
        error: 'Model does not support vision',
      });

      expect(telemetry.records()).toEqual([
        expect.objectContaining({
          status: 400,
          outcome: 'rejected',
          code: 'MODEL_UNAVAILABLE',
          hasImages: true,
          model: 'cf-llama-3.3-70b',
        }),
      ]);
      // Image data must never be logged in telemetry or console
      expect(JSON.stringify(telemetry.records())).not.toContain('base64');
    } finally {
      telemetry.restore();
    }
  });

  it('rejects unsupported image format', async () => {
    const response = await handleAiChat(
      makeCtx({
        model: 'ukisai-swift-max',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe this' },
              { type: 'image_url', image_url: { url: 'data:image/bmp;base64,Qk0=' } },
            ],
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toContain('data:image/(jpeg|png|webp);base64,...');
  });

  it('rejects oversized image payloads over 3MB', async () => {
    // 3MB binary is ~4MB base64. Create base64 of 4.5MB
    const oversizedBase64 = 'A'.repeat(4.5 * 1024 * 1024);
    const response = await handleAiChat(
      makeCtx({
        model: 'ukisai-swift-max',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${oversizedBase64}` },
              },
            ],
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toContain('Image exceeds 3MB limit');
  });

  it('rejects batched multiple page images in single request', async () => {
    const response = await handleAiChat(
      makeCtx({
        model: 'ukisai-swift-max',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: sampleValidJpeg } },
              { type: 'image_url', image_url: { url: sampleValidJpeg } },
            ],
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toContain('Only single-page image payloads are supported');
  });

  it('successfully passes vision payload to ukisai provider and logs hasImages in telemetry', async () => {
    const originalFetch = globalThis.fetch;
    const telemetry = captureTelemetry();
    try {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: ukisaiStream(),
      } as unknown as Response);
      globalThis.fetch = fetchMock;

      const response = await handleAiChat(
        makeCtx({
          model: 'ukisai-swift-max',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Transcribe this page' },
                { type: 'image_url', image_url: { url: sampleValidJpeg } },
              ],
            },
          ],
        }),
      );

      expect(response.status).toBe(200);
      const events = await readEvents(response);
      expect(events.at(-1)).toMatchObject({
        type: 'done',
        model: 'ukisai-swift-max',
      });

      // Verify request payload forwarded to ukisai
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
      const sentBody = JSON.parse(init.body) as {
        messages: Array<{ role: string; content: unknown }>;
      };
      const userMsg = sentBody.messages.find((m) => m.role === 'user');
      expect(userMsg?.content).toEqual([
        { type: 'text', text: 'Transcribe this page' },
        { type: 'image_url', image_url: { url: sampleValidJpeg } },
      ]);

      // Telemetry records hasImages: true and DOES NOT log raw image content
      const [record] = telemetry.records();
      expect(record).toMatchObject({
        hasImages: true,
        status: 200,
        outcome: 'ok',
        model: 'ukisai-swift-max',
      });
      expect(JSON.stringify(telemetry.records())).not.toContain(sampleValidJpeg);
    } finally {
      globalThis.fetch = originalFetch;
      telemetry.restore();
    }
  });
});
