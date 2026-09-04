import { describe, expect, it } from 'vitest';
import worker, { type AiBinding, type Env } from '../index';
import { createMockD1 } from './helpers/mockD1';

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
    expect(await res.json()).toEqual({
      error: 'Cloudflare Workers AI binding not configured on Worker',
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
});
