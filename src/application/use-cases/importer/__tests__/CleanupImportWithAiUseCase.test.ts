import { describe, it, expect } from 'vitest';
import { CleanupImportWithAiUseCase } from '../CleanupImportWithAiUseCase';
import type { AiService } from '../../../../domain/ai/services/AiService';
import type { AiStreamEvent, AiChatRequest } from '../../../../domain/ai/models/ai.types';
import type { AiModelCatalog } from '../../../../domain/ai/services/aiModelCatalog';
import {
  DEFAULT_AI_MODEL_CATALOG,
  getAiModelDescriptor,
} from '../../../../domain/ai/services/aiModelCatalog';

describe('CleanupImportWithAiUseCase', () => {
  it('streams cleaned markdown and strips markdown code fences', async () => {
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'token', text: '```markdown\n# Cleaned Heading\n\n- Point A\n- Point B\n```' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    const result = await useCase.execute('dirty text', 'My Doc');

    expect(result.original).toBe('dirty text');
    expect(result.cleaned).toBe('# Cleaned Heading\n\n- Point A\n- Point B');
  });

  it('strips generic code fences without language identifier', async () => {
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'token', text: '```\n# Generic Fenced\n```' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    const result = await useCase.execute({ markdown: 'raw text' });

    expect(result.cleaned).toBe('# Generic Fenced');
  });

  it('throws an explicit error when output is empty or whitespace', async () => {
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'token', text: '   \n\t  ' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    await expect(useCase.execute({ markdown: 'valid raw markdown' })).rejects.toThrow(
      'AI cleanup returned an empty response.',
    );
  });

  it('throws an explicit error when output fence has empty content', async () => {
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'token', text: '```markdown\n\n```' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    await expect(useCase.execute({ markdown: 'valid raw markdown' })).rejects.toThrow(
      'AI cleanup returned an empty response.',
    );
  });

  it('guards input length and throws when markdown exceeds descriptor.maxDocumentContextChars', async () => {
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {},
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const descriptor = getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG);
    const oversizedMarkdown = 'a'.repeat(descriptor.maxDocumentContextChars + 1);

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    await expect(useCase.execute({ markdown: oversizedMarkdown })).rejects.toThrow(
      'Document is too large for AI cleanup. Please edit manually or clean in smaller sections.',
    );
  });

  it('forwards model and signal to streamChat via CleanupImportRequest', async () => {
    let capturedRequest: AiChatRequest | undefined;
    const controller = new AbortController();

    const mockAiService: AiService = {
      async *streamChat(request: AiChatRequest): AsyncIterable<AiStreamEvent> {
        capturedRequest = request;
        yield { type: 'token', text: '# Output' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    await useCase.execute({
      markdown: 'test markdown',
      title: 'Test Title',
      model: 'ukisai-swift-max',
      signal: controller.signal,
    });

    expect(capturedRequest?.model).toBe('ukisai-swift-max');
    expect(capturedRequest?.signal).toBe(controller.signal);
    expect(capturedRequest?.messages[1].content).toBe('# Test Title\n\ntest markdown');
  });

  it('forwards model and signal via backward-compatible positional signature', async () => {
    let capturedRequest: AiChatRequest | undefined;
    const controller = new AbortController();

    const mockAiService: AiService = {
      async *streamChat(request: AiChatRequest): AsyncIterable<AiStreamEvent> {
        capturedRequest = request;
        yield { type: 'token', text: '# Positional Output' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    await useCase.execute('test markdown', 'Positional Title', {
      model: 'cf-llama-3.3-70b',
      signal: controller.signal,
    });

    expect(capturedRequest?.model).toBe('cf-llama-3.3-70b');
    expect(capturedRequest?.signal).toBe(controller.signal);
    expect(capturedRequest?.messages[1].content).toBe('# Positional Title\n\ntest markdown');
  });

  it('propagates stream error events as thrown errors', async () => {
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'error', code: 'RATE_LIMITED', message: 'Rate limit reached. Please wait.' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    await expect(useCase.execute({ markdown: 'some text' })).rejects.toThrow(
      'Rate limit reached. Please wait.',
    );
  });

  it('propagates thrown stream exceptions', async () => {
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        if (true as boolean) {
          throw new Error('Network connection aborted');
        }
        yield { type: 'token', text: '' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    await expect(useCase.execute({ markdown: 'some text' })).rejects.toThrow(
      'Network connection aborted',
    );
  });

  it('detects model truncation when completion tokens reach maxOutputTokens limit', async () => {
    const descriptor = getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, 'cf-llama-3.3-70b');
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'token', text: '# Truncated Content...' };
        yield {
          type: 'done',
          usage: {
            completionTokens: descriptor.maxOutputTokens,
            totalTokens: descriptor.maxOutputTokens + 100,
          },
        };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    await expect(
      useCase.execute({
        markdown: 'original text',
        model: 'cf-llama-3.3-70b',
      }),
    ).rejects.toThrow(
      `AI cleanup was cut off at the model output limit (${descriptor.maxOutputTokens} tokens). Original document preserved.`,
    );
  });

  it('allows completion when completion tokens are strictly below maxOutputTokens limit', async () => {
    const descriptor = getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, 'cf-llama-3.3-70b');
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'token', text: '# Valid Completion' };
        yield {
          type: 'done',
          usage: {
            completionTokens: descriptor.maxOutputTokens - 1,
          },
        };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    const result = await useCase.execute({
      markdown: 'original text',
      model: 'cf-llama-3.3-70b',
    });

    expect(result.cleaned).toBe('# Valid Completion');
  });

  it('respects limits from a passed custom catalog overriding the default bundled mirror', async () => {
    const customCatalog: AiModelCatalog = {
      version: 'custom-2026-test',
      availability: 'available',
      defaultModelId: 'custom-model',
      models: [
        {
          id: 'custom-model',
          provider: 'workers-ai',
          providerModelId: 'custom-provider-id',
          display: { name: 'Custom Model' },
          contextWindowTokens: 2000,
          maxOutputTokens: 100,
          maxDocumentContextChars: 80,
          pricing: null,
        },
      ],
    };

    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {},
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);

    // 100 chars exceeds custom-model's maxDocumentContextChars (80), but is far below default's 16_000
    const oversizedForCustom = 'x'.repeat(100);

    // Object request syntax
    await expect(
      useCase.execute({
        markdown: oversizedForCustom,
        catalog: customCatalog,
      }),
    ).rejects.toThrow(
      'Document is too large for AI cleanup. Please edit manually or clean in smaller sections.',
    );

    // Backward-compatible positional syntax
    await expect(
      useCase.execute(oversizedForCustom, 'Test Title', { catalog: customCatalog }),
    ).rejects.toThrow(
      'Document is too large for AI cleanup. Please edit manually or clean in smaller sections.',
    );
  });

  it('detects model truncation against custom catalog maxOutputTokens', async () => {
    const customCatalog: AiModelCatalog = {
      version: 'custom-tight-tokens',
      availability: 'available',
      defaultModelId: 'tight-model',
      models: [
        {
          id: 'tight-model',
          provider: 'workers-ai',
          providerModelId: 'tight-id',
          display: { name: 'Tight Output Model' },
          contextWindowTokens: 500,
          maxOutputTokens: 20,
          maxDocumentContextChars: 5000,
          pricing: null,
        },
      ],
    };

    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'token', text: 'Some text...' };
        yield {
          type: 'done',
          usage: {
            completionTokens: 20,
            totalTokens: 50,
          },
        };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    await expect(
      useCase.execute({
        markdown: 'valid markdown',
        catalog: customCatalog,
      }),
    ).rejects.toThrow(
      'AI cleanup was cut off at the model output limit (20 tokens). Original document preserved.',
    );
  });
});
