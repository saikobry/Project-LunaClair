import { describe, expect, it } from 'vitest';
import { resolveAiProvider } from '../providers';
import { readSseData } from '../sse';
import { UKISAI_DEFAULT_BASE_URL, UkisAiProvider } from '../ukisai';
import { WorkersAiProvider } from '../workersAi';
import type { AiModelRoute } from '../../core/aiModels';
import type { Env } from '../../core/types';

const workersAiRoute: AiModelRoute = {
  id: 'cf-llama-3.3-70b',
  provider: 'workers-ai',
  providerModelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  contextWindowTokens: 24_000,
  maxOutputTokens: 4_096,
  maxDocumentContextChars: 16_000,
  pricing: null,
  display: { name: 'Standard' },
};

const ukisaiRoute: AiModelRoute = {
  ...workersAiRoute,
  id: 'ukisai-swift-max',
  provider: 'ukisai',
  providerModelId: 'swift',
  display: { name: 'MAX' },
};

describe('resolveAiProvider', () => {
  it('returns a Workers AI provider only when the binding exists', () => {
    const withBinding = { DB: {}, AI: { run: async () => null } } as unknown as Env;
    const withoutBinding = { DB: {} } as unknown as Env;

    expect(resolveAiProvider(workersAiRoute, withBinding)).toBeInstanceOf(WorkersAiProvider);
    expect(resolveAiProvider(workersAiRoute, withoutBinding)).toBeUndefined();
  });

  it('returns the UkisAI provider without any credential', () => {
    // The endpoint is keyless, so no env var is required for it to be usable.
    expect(resolveAiProvider(ukisaiRoute, { DB: {} } as unknown as Env)).toBeInstanceOf(UkisAiProvider);
  });

  it('honours the base URL override and otherwise uses the hosted endpoint', () => {
    const overridden = resolveAiProvider(ukisaiRoute, {
      DB: {},
      UKISAI_BASE_URL: 'https://stub.test/v1',
    } as unknown as Env) as UkisAiProvider;
    const hosted = resolveAiProvider(ukisaiRoute, { DB: {} } as unknown as Env) as UkisAiProvider;

    expect(overridden).toBeInstanceOf(UkisAiProvider);
    expect(hosted).toBeInstanceOf(UkisAiProvider);
    expect(UKISAI_DEFAULT_BASE_URL).toBe('https://ukisai.com/api/swift/v1');
  });
});

describe('readSseData', () => {
  function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
  }

  it('reassembles a payload split across chunk boundaries', async () => {
    const payloads: string[] = [];
    for await (const payload of readSseData(
      streamOf(['data: {"resp', 'onse":"Hi"}\n\ndata: [DONE]\n\n']),
    )) {
      payloads.push(payload);
    }

    expect(payloads).toEqual(['{"response":"Hi"}', '[DONE]']);
  });

  it('ignores non-data lines and blank payloads', async () => {
    const payloads: string[] = [];
    for await (const payload of readSseData(
      streamOf([': comment\n\nevent: ping\ndata: \n\ndata: {"a":1}\n\n']),
    )) {
      payloads.push(payload);
    }

    expect(payloads).toEqual(['{"a":1}']);
  });

  it('yields a trailing payload with no final newline', async () => {
    const payloads: string[] = [];
    for await (const payload of readSseData(streamOf(['data: {"last":true}']))) {
      payloads.push(payload);
    }

    expect(payloads).toEqual(['{"last":true}']);
  });
});
