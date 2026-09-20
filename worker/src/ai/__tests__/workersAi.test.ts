import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkersAiProvider } from '../workersAi';
import type { AiBinding } from '../../core/types';

function sseStream(payloads: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const payload of payloads) controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      controller.close();
    },
  });
}

function providerFor(response: unknown, onRun?: (model: string, inputs: Record<string, unknown>) => void) {
  const binding: AiBinding = {
    run: async (model, inputs) => {
      onRun?.(model, inputs);
      return response;
    },
  };
  return new WorkersAiProvider(binding);
}

async function collect(provider: WorkersAiProvider) {
  const events = [];
  for await (const event of provider.stream({
    modelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
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

describe('WorkersAiProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('invokes the binding with the requested reserved output and stream flag', async () => {
    let seen: Record<string, unknown> | undefined;
    const provider = providerFor(sseStream(['{"response":"Hi"}']), (_model, inputs) => {
      seen = inputs;
    });

    await collect(provider);

    expect(seen).toMatchObject({ stream: true, max_tokens: 4_096 });
  });

  it('normalizes response text into tokens and usage into a usage event', async () => {
    const provider = providerFor(
      sseStream([
        '{"response":"Hello"}',
        '{"response":" there"}',
        '{"response":"","usage":{"prompt_tokens":7,"completion_tokens":3,"total_tokens":10}}',
      ]),
    );

    expect(await collect(provider)).toEqual([
      { type: 'token', text: 'Hello' },
      { type: 'token', text: ' there' },
      { type: 'usage', usage: { promptTokens: 7, completionTokens: 3, totalTokens: 10 } },
    ]);
  });

  it('stops at the terminal marker', async () => {
    const provider = providerFor(sseStream(['{"response":"Hi"}', '[DONE]', '{"response":"ignored"}']));

    expect(await collect(provider)).toEqual([{ type: 'token', text: 'Hi' }]);
  });

  it('logs an unreadable payload instead of failing the stream', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = providerFor(sseStream(['{"error":"model is not available"}']));

    expect(await collect(provider)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      'Workers AI sent a payload this endpoint does not understand',
      expect.objectContaining({ sample: '{"error":"model is not available"}' }),
    );
  });

  it('does not warn when the payload carried text or usage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = providerFor(sseStream(['{"response":"Hi"}', '{"usage":{"total_tokens":5}}']));

    await collect(provider);

    expect(warn).not.toHaveBeenCalled();
  });

  it('maps a binding failure to a provider error', async () => {
    const binding: AiBinding = {
      run: async () => {
        throw new Error('binding unavailable');
      },
    };

    await expect(collect(new WorkersAiProvider(binding))).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      message: 'binding unavailable',
    });
  });

  it('fails when the binding returns something that is not a stream', async () => {
    await expect(collect(providerFor({ not: 'a stream' }))).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
    });
  });
});
