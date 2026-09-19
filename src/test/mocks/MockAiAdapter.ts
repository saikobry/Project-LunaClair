import type { AiService } from '../../domain/ai/services/AiService';
import {
  AiGenerationError,
  type AiChatRequest,
  type AiStreamEvent,
  type AiGenerationRequest,
  type AiStructuredOutputValidator,
} from '../../domain/ai/models/ai.types';
import { parseStructuredAiResponse } from '../../infrastructure/ai/parsing/parseStructuredAiResponse';

export interface MockAiAdapterOptions {
  tokens?: string[];
  structuredResponse?: string | unknown;
  delayMs?: number;
  shouldFail?: boolean;
  errorCode?: string;
  errorMessage?: string;
  /** The wait a provider states on a refusal, so cooldown behavior can be exercised. */
  retryAfterSeconds?: number;
}

/**
 * Deterministic Mock AI Adapter for unit and integration testing.
 */
export class MockAiAdapter implements AiService {
  private readonly tokens: string[];
  private readonly structuredResponse?: string | unknown;
  private readonly delayMs: number;
  private readonly shouldFail: boolean;
  private readonly errorCode: string;
  private readonly errorMessage: string;
  private readonly retryAfterSeconds?: number;

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
    this.structuredResponse = options.structuredResponse;
    this.delayMs = options.delayMs ?? 0;
    this.shouldFail = options.shouldFail ?? false;
    this.errorCode = options.errorCode ?? 'MOCK_ERROR';
    this.errorMessage = options.errorMessage ?? 'Simulated AI failure';
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  async *streamChat(request: AiChatRequest): AsyncIterable<AiStreamEvent> {
    if (request.signal?.aborted) {
      yield { type: 'error', code: 'ABORTED', message: 'Chat request was cancelled.' };
      return;
    }

    if (this.shouldFail) {
      yield {
        type: 'error',
        code: this.errorCode,
        message: this.errorMessage,
        ...(this.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: this.retryAfterSeconds }
          : {}),
      };
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

  async generateStructured<T>(
    request: AiGenerationRequest,
    validator: AiStructuredOutputValidator<T>,
  ): Promise<T> {
    if (request.signal?.aborted) {
      throw new AiGenerationError('Generation request was cancelled.', 'ABORTED');
    }

    if (this.shouldFail) {
      throw new AiGenerationError(this.errorMessage, this.errorCode);
    }

    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    if (this.structuredResponse !== undefined) {
      if (typeof this.structuredResponse === 'string') {
        return parseStructuredAiResponse(this.structuredResponse, validator);
      }
      const validated = validator(this.structuredResponse);
      if (validated.success) {
        return validated.data;
      }
      throw new AiGenerationError(
        `Structured output validation failed: ${validated.error}`,
        'INVALID_STRUCTURED_OUTPUT',
      );
    }

    // Default: use accumulated tokens as string
    const rawText = this.tokens.join('');
    return parseStructuredAiResponse(rawText, validator);
  }
}
