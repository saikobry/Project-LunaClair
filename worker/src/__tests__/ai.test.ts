import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type AiBinding, type Env } from '../index';
import { createMockD1 } from './helpers/mockD1';

/** Builds a single-use SSE stream from raw Workers AI chunk payloads. */
function mockAiStream(payloads: string[]): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const payload of payloads) controller.enqueue(encoder.encode(`${payload}\n\n`));
      controller.close();
    },
  });
}

function chatRequest(): Request {
  return new Request('https://api.test/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
  });
}

describe('Worker /api/ai/chat Endpoint', () => {
  const baseEnv: Env = {
    DB: createMockD1(),
    CORS_ORIGINS: 'https://test.lunaclair.app',
  };

  it('returns 503 when AI binding is not configured', async () => {
    const req = new Request('https://api.test/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    });
    const res = await worker.fetch(req, baseEnv);

    expect(res.status).toBe(503);
    // Failures carry a normalized code so the client can act on the cause, not the status number.
    expect(await res.json()).toMatchObject({
      error: 'Cloudflare Workers AI binding not configured on Worker',
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('returns 400 when messages array is missing or empty', async () => {
    const envWithAi: Env = {
      ...baseEnv,
      AI: {
        run: async () => new ReadableStream(),
      },
    };

    const req = new Request('https://api.test/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    const res = await worker.fetch(req, envWithAi);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Invalid request: messages array is required',
    });
  });

  it('streams SSE tokens when AI responds successfully', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"response": "Hello"}\n\n'));
        controller.enqueue(encoder.encode('data: {"response": " student!"}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    const mockAi: AiBinding = {
      run: async () => mockStream,
    };

    const envWithAi: Env = {
      ...baseEnv,
      AI: mockAi,
    };

    const req = new Request('https://api.test/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'socratic',
        documentContext: {
          title: 'Cell Bio',
          markdown: '# Cells',
        },
      }),
    });
    const res = await worker.fetch(req, envWithAi);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('"type":"start"');
    expect(text).toContain('"type":"token","text":"Hello"');
    expect(text).toContain('"type":"token","text":" student!"');
    expect(text).toContain('"type":"done"');
  });

  it('returns 405 for GET /api/ai/chat', async () => {
    const req = new Request('https://api.test/api/ai/chat', {
      method: 'GET',
    });
    const res = await worker.fetch(req, baseEnv);

    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toContain('POST');
  });

  describe('terminal event telemetry', () => {
    afterEach(() => vi.restoreAllMocks());

    it('forwards the provider usage and serving model on the done event', async () => {
      const envWithAi: Env = {
        ...baseEnv,
        AI: {
          run: async () =>
            mockAiStream([
              'data: {"response": "Hi"}',
              // Cloudflare reports snake_case on the terminal chunk.
              'data: {"response":"","usage":{"prompt_tokens":4820,"completion_tokens":312,"total_tokens":5132}}',
            ]),
        },
      };

      const res = await worker.fetch(chatRequest(), envWithAi);
      const text = await res.text();

      expect(text).toContain('"type":"done"');
      expect(text).toContain(
        '"usage":{"promptTokens":4820,"completionTokens":312,"totalTokens":5132}',
      );
      // The app-facing catalog id, not the provider's own model id: the client selects and prices
      // by the catalog, so the terminal event must name that id.
      expect(text).toContain('"model":"cf-llama-3.3-70b"');
      expect(text).not.toContain('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    });

    it('omits usage rather than reporting a fabricated zero', async () => {
      const envWithAi: Env = {
        ...baseEnv,
        AI: { run: async () => mockAiStream(['data: {"response": "Hi"}']) },
      };

      const res = await worker.fetch(chatRequest(), envWithAi);
      const text = await res.text();

      expect(text).not.toContain('"usage"');
      expect(text).toContain('"model":"cf-llama-3.3-70b"');
    });

    it('logs what the provider sent when a stream produces no tokens', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const info = vi.spyOn(console, 'log').mockImplementation(() => {});
      const envWithAi: Env = {
        ...baseEnv,
        // A provider error object: without this the client sees only a start and a done.
        AI: { run: async () => mockAiStream(['data: {"error":"model is not available"}']) },
      };

      const res = await worker.fetch(chatRequest(), envWithAi);
      const text = await res.text();

      expect(text).toContain('"type":"done"');
      // The provider knows which payload was unreadable; the route's own record counts the delivery
      // (`emittedTokenChunks: 0`), which is what makes this case measurable instead of a lone warning.
      expect(warn).toHaveBeenCalledWith(
        'Workers AI sent a payload this endpoint does not understand',
        expect.objectContaining({ sample: '{"error":"model is not available"}' }),
      );
      expect(info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ai.chat',
          status: 200,
          outcome: 'ok',
          model: 'cf-llama-3.3-70b',
          provider: 'workers-ai',
          emittedTokenChunks: 0,
        }),
      );
    });

    it('does not warn when tokens were produced', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const envWithAi: Env = {
        ...baseEnv,
        AI: { run: async () => mockAiStream(['data: {"response": "Hi"}']) },
      };

      const res = await worker.fetch(chatRequest(), envWithAi);
      await res.text();

      expect(warn).not.toHaveBeenCalled();
    });

    it('fails visibly instead of substituting another model', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      let calls = 0;
      const envWithAi: Env = {
        ...baseEnv,
        AI: {
          run: async () => {
            calls += 1;
            throw new Error('primary unavailable');
          },
        },
      };

      const res = await worker.fetch(chatRequest(), envWithAi);

      // The old silent retry named a model Cloudflare deprecated on 2026-05-30, so a failure could
      // surface as an unrelated second failure. One call, and an answer the user can act on.
      expect(calls).toBe(1);
      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({ code: 'UPSTREAM_ERROR' });
    });
  });
});
