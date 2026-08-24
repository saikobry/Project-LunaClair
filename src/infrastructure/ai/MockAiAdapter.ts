import type { AiService } from '../../domain/ai/AiService';
import type { AiChatRequest, AiStreamEvent } from '../../domain/ai/ai.types';

export interface MockAiAdapterOptions {
  tokens?: string[];
  delayMs?: number;
  shouldFail?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Deterministic Mock AI Adapter for unit and integration testing.
 */
export class MockAiAdapter implements AiService {
  private readonly tokens: string[];
  private readonly delayMs: number;
  private readonly shouldFail: boolean;
  private readonly errorCode: string;
  private readonly errorMessage: string;

  constructor(options: MockAiAdapterOptions = {}) {
    this.tokens = options.tokens ?? [
      'The ',
      'sinoatrial ',
      'node ',
      'is ',
      'the ',
      'heart’s ',
      'natural ',
      'pacemaker.',
    ];
    this.delayMs = options.delayMs ?? 0;
    this.shouldFail = options.shouldFail ?? false;
    this.errorCode = options.errorCode ?? 'MOCK_ERROR';
    this.errorMessage = options.errorMessage ?? 'Simulated AI failure';
  }

  async *streamChat(request: AiChatRequest): AsyncIterable<AiStreamEvent> {
    if (request.signal?.aborted) {
      yield { type: 'error', code: 'ABORTED', message: 'Chat request was cancelled.' };
      return;
    }

    if (this.shouldFail) {
      yield { type: 'error', code: this.errorCode, message: this.errorMessage };
      return;
    }

    const messageId = `mock-msg-${Date.now()}`;
    yield { type: 'start', messageId };

    for (const token of this.tokens) {
      if (request.signal?.aborted) {
        yield { type: 'error', code: 'ABORTED', message: 'Chat request was cancelled.' };
        return;
      }

      if (this.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      }

      yield { type: 'token', text: token };
    }

    yield {
      type: 'done',
      usage: {
        promptTokens: 25,
        completionTokens: this.tokens.length,
        totalTokens: 25 + this.tokens.length,
      },
    };
  }
}
