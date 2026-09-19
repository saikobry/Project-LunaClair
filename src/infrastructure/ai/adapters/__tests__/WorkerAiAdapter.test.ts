import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerAiAdapter } from '../WorkerAiAdapter';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import type { AiChatRequest, AiStreamEvent } from '../../../../domain/ai/models/ai.types';

describe('WorkerAiAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('correctly parses fragmented SSE chunks into stream events', async () => {
    const encoder = new TextEncoder();
    // Simulate fragmented chunks: data split across reads
    const chunks = [
      encoder.encode('data: {"type":"start","messageId":"msg-123"}\n\n'),
      encoder.encode('data: {"type":"token","text":"Pac'),
      encoder.encode('emaker"}\n\ndata: {"type":"token","text":" of the heart"}\n\n'),
      // The Worker reports which model served the turn so the client can price it correctly.
      encoder.encode(
        'data: {"type":"done","usage":{"promptTokens":10,"completionTokens":5},"model":"@cf/meta/llama-3.3-70b-instruct-fp8-fast"}\n\n',
      ),
    ];

    let chunkIndex = 0;
    const mockStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          controller.enqueue(chunks[chunkIndex++]);
        } else {
          controller.close();
        }
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: mockStream,
    } as unknown as Response);

    const adapter = new WorkerAiAdapter({ baseUrl: 'https://api.test' });
    const request: AiChatRequest = {
      messages: [{ id: '1', role: 'user', content: 'What is SA node?', createdAt: new Date().toISOString() }],
      mode: 'assistant',
    };

    const events: AiStreamEvent[] = [];
    for await (const event of adapter.streamChat(request)) {
      events.push(event);
    }

    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({ type: 'start', messageId: 'msg-123' });
    expect(events[1]).toEqual({ type: 'token', text: 'Pacemaker' });
    expect(events[2]).toEqual({ type: 'token', text: ' of the heart' });
    expect(events[3]).toEqual({
      type: 'done',
      usage: { promptTokens: 10, completionTokens: 5 },
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    });
  });

  it('handles HTTP error responses gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ error: 'Cloudflare Workers AI binding not configured' }),
    } as unknown as Response);

    const adapter = new WorkerAiAdapter();
    const request: AiChatRequest = {
      messages: [{ id: '1', role: 'user', content: 'hello', createdAt: new Date().toISOString() }],
      mode: 'assistant',
    };

    const events: AiStreamEvent[] = [];
    for await (const event of adapter.streamChat(request)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'error',
      code: 'HTTP_503',
      message: 'Cloudflare Workers AI binding not configured',
    });
  });

  it('surfaces the Worker failure code and the wait it stated', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: 'Rate limit: 5 prompts per minute per IP. Try again in 7s.',
        code: 'RATE_LIMITED',
        retryAfterSeconds: 7,
      }),
    } as unknown as Response);

    const adapter = new WorkerAiAdapter();
    const events: AiStreamEvent[] = [];
    for await (const event of adapter.streamChat({
      messages: [{ id: '1', role: 'user', content: 'hi', createdAt: new Date().toISOString() }],
      mode: 'assistant',
      model: 'ukisai-swift-max',
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: 'error',
        code: 'RATE_LIMITED',
        message: 'Rate limit: 5 prompts per minute per IP. Try again in 7s.',
        retryAfterSeconds: 7,
      },
    ]);
  });

  it('forwards the requested model to the gateway', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    const adapter = new WorkerAiAdapter({ baseUrl: 'https://api.test' });
    const events: AiStreamEvent[] = [];
    for await (const event of adapter.streamChat({
      messages: [{ id: '1', role: 'user', content: 'hi', createdAt: new Date().toISOString() }],
      mode: 'assistant',
      model: 'ukisai-swift-max',
    })) {
      events.push(event);
    }

    // An empty stream body yields nothing; the request body is what this test is about.
    expect(events).toEqual([]);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(init.body)).toMatchObject({ model: 'ukisai-swift-max' });
  });

  it('handles client abort signal gracefully', async () => {
    const controller = new AbortController();
    const adapter = new WorkerAiAdapter();

    controller.abort();

    const request: AiChatRequest = {
      messages: [{ id: '1', role: 'user', content: 'hello', createdAt: new Date().toISOString() }],
      mode: 'assistant',
      signal: controller.signal,
    };

    const events: AiStreamEvent[] = [];
    for await (const event of adapter.streamChat(request)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'error',
      code: 'ABORTED',
      message: 'Chat request was cancelled.',
    });
  });
});

describe('MockAiAdapter', () => {
  it('yields token sequence and completion event', async () => {
    const mock = new MockAiAdapter({
      tokens: ['Hello', ' ', 'world!'],
    });

    const request: AiChatRequest = {
      messages: [{ id: '1', role: 'user', content: 'hi', createdAt: new Date().toISOString() }],
      mode: 'assistant',
    };

    const events: AiStreamEvent[] = [];
    for await (const event of mock.streamChat(request)) {
      events.push(event);
    }

    expect(events).toHaveLength(5);
    expect(events[0].type).toBe('start');
    expect(events[1]).toEqual({ type: 'token', text: 'Hello' });
    expect(events[2]).toEqual({ type: 'token', text: ' ' });
    expect(events[3]).toEqual({ type: 'token', text: 'world!' });
    expect(events[4].type).toBe('done');
  });

  it('yields error event when shouldFail is true', async () => {
    const mock = new MockAiAdapter({
      shouldFail: true,
      errorCode: 'CUSTOM_FAIL',
      errorMessage: 'Testing error flow',
    });

    const events: AiStreamEvent[] = [];
    for await (const event of mock.streamChat({
      messages: [{ id: '1', role: 'user', content: 'hi', createdAt: new Date().toISOString() }],
      mode: 'assistant',
    })) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'error',
      code: 'CUSTOM_FAIL',
      message: 'Testing error flow',
    });
  });
});
