import { describe, it, expect } from 'vitest';
import {
  CleanupImportWithAiUseCase,
  assembleCleanedChunks,
  extractSafePrecedingSnippet,
  type AiCleanupProgress,
} from '../CleanupImportWithAiUseCase';
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

  it('guards input length and throws when a single request exceeds descriptor.maxDocumentContextChars', async () => {
    const tightCatalog: AiModelCatalog = {
      version: 'tight-context',
      availability: 'available',
      defaultModelId: 'tight-context-model',
      models: [
        {
          id: 'tight-context-model',
          provider: 'workers-ai',
          providerModelId: 'tight-context-provider',
          display: { name: 'Tight Context Model' },
          contextWindowTokens: 400,
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

    // Short enough to take the single-request path, longer than the model accepts.
    const oversizedMarkdown = 'a'.repeat(120);

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    await expect(
      useCase.execute({ markdown: oversizedMarkdown, catalog: tightCatalog }),
    ).rejects.toThrow(
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

/**
 * ~9,060 characters across three heading sections: above the 9,000 fast-path threshold, so it takes
 * the chunked path and lands in two requests.
 */
function bigDocument(): string {
  const filler = 'word '.repeat(600);
  return ['# Big Doc', '', ...Array.from({ length: 3 }, (_, index) => `## Section ${index}\n\n${filler}`)].join(
    '\n\n',
  );
}

function sectionPrompt(request: AiChatRequest): string {
  return request.messages[1].content as string;
}

describe('extractSafePrecedingSnippet', () => {
  it('returns empty string for empty input or non-positive maxChars', () => {
    expect(extractSafePrecedingSnippet('')).toBe('');
    expect(extractSafePrecedingSnippet('Some text.', 0)).toBe('');
    expect(extractSafePrecedingSnippet('Some text.', -10)).toBe('');
  });

  it('returns full text when within maxChars and ends on sentence boundary', () => {
    const text = 'This is a complete sentence. And here is another.';
    expect(extractSafePrecedingSnippet(text, 100)).toBe(text);
  });

  it('snaps to the first sentence boundary within the window so snippet starts on complete sentence', () => {
    const text = 'Fragment of sentence 1. Sentence 2 is fully intact. Sentence 3 is also here.';
    // Slice window of 60 chars cuts into sentence 1
    const snippet = extractSafePrecedingSnippet(text, 60);
    expect(snippet).toBe('Sentence 2 is fully intact. Sentence 3 is also here.');
  });

  it('ensures the snippet ends on a sentence boundary when the tail was truncated', () => {
    const text = 'Sentence 1. Sentence 2 is complete. Incomplete sentence fragment';
    const snippet = extractSafePrecedingSnippet(text, 100);
    expect(snippet).toBe('Sentence 1. Sentence 2 is complete.');
  });

  it('returns empty string if no complete sentence boundary exists in the window', () => {
    const text = 'This is just one single continuous line of words without any punctuation whatsoever';
    expect(extractSafePrecedingSnippet(text, 50)).toBe('');
  });

  it('preserves complete paragraphs ending on paragraph break', () => {
    const text = '## Section Title\n\nParagraph body text here.\n\n';
    expect(extractSafePrecedingSnippet(text, 100)).toBe('## Section Title\n\nParagraph body text here.');
  });
});

describe('assembleCleanedChunks', () => {
  it('joins sections with a blank line', () => {
    expect(assembleCleanedChunks(['alpha', 'beta'])).toBe('alpha\n\nbeta');
  });

  it('drops a heading repeated at the start of the next section', () => {
    expect(assembleCleanedChunks(['# Doc\n\n## Alpha\n\nbody', '## Alpha\n\nmore'])).toBe(
      '# Doc\n\n## Alpha\n\nbody\n\nmore',
    );
  });

  it('keeps headings that are not repeated across the boundary', () => {
    expect(assembleCleanedChunks(['## Alpha', '## Beta'])).toBe('## Alpha\n\n## Beta');
  });

  it('trims exact paragraph overlap at the seam between chunks', () => {
    const chunk1 = '## Section 1\n\nThe Committee shall convene quarterly to review safety compliance records and issue recommendations.';
    const chunk2 = 'The Committee shall convene quarterly to review safety compliance records and issue recommendations.\n\nIn addition, an annual audit shall be conducted.';

    const assembled = assembleCleanedChunks([chunk1, chunk2]);

    expect(assembled).toBe(
      '## Section 1\n\nThe Committee shall convene quarterly to review safety compliance records and issue recommendations.\n\nIn addition, an annual audit shall be conducted.',
    );
  });

  it('trims both repeated heading and repeated leading paragraph at the seam', () => {
    const chunk1 = '## Section 2\n\nAll members are required to attend mandatory training sessions annually.';
    const chunk2 = '## Section 2\n\nAll members are required to attend mandatory training sessions annually.\n\nFailure to attend will result in reassessment.';

    const assembled = assembleCleanedChunks([chunk1, chunk2]);

    expect(assembled).toBe(
      '## Section 2\n\nAll members are required to attend mandatory training sessions annually.\n\nFailure to attend will result in reassessment.',
    );
  });

  it('trims multi-line overlap at chunk seam', () => {
    const chunk1 = 'Line 1 of important policy.\nLine 2 of important policy.';
    const chunk2 = 'Line 1 of important policy.\nLine 2 of important policy.\nLine 3 of the policy.';

    const assembled = assembleCleanedChunks([chunk1, chunk2]);

    expect(assembled).toBe(
      'Line 1 of important policy.\nLine 2 of important policy.\n\nLine 3 of the policy.',
    );
  });

  it('does not trim short non-paragraph lines under 20 chars', () => {
    const chunk1 = 'Item details:\n- alpha';
    const chunk2 = '- alpha\n- beta';

    const assembled = assembleCleanedChunks([chunk1, chunk2]);

    expect(assembled).toBe('Item details:\n- alpha\n\n- alpha\n- beta');
  });

  it('prunes dangling proper-prefix prose tail from assembled chunk at seam', () => {
    const chunk1 =
      '## Section 1\n\nIntroductory remarks.\n\nThe committee met on Monday to discuss various policies regarding university';
    const chunk2 =
      'The committee met on Monday to discuss various policies regarding university governance and academic integrity.\n\nSubsequent paragraph.';

    const assembled = assembleCleanedChunks([chunk1, chunk2]);

    expect(assembled).toBe(
      '## Section 1\n\nIntroductory remarks.\n\nThe committee met on Monday to discuss various policies regarding university governance and academic integrity.\n\nSubsequent paragraph.',
    );
  });

  it('prunes dangling prose tail cut mid-word when next chunk contains the word continuation', () => {
    const chunk1 =
      '## Section 1\n\nFull previous paragraph.\n\nStudents must complete the mandatory prerequis';
    const chunk2 =
      'Students must complete the mandatory prerequisite courses before enrolling.\n\nFinal paragraph.';

    const assembled = assembleCleanedChunks([chunk1, chunk2]);

    expect(assembled).toBe(
      '## Section 1\n\nFull previous paragraph.\n\nStudents must complete the mandatory prerequisite courses before enrolling.\n\nFinal paragraph.',
    );
  });

  it('does not prune trailing line if it ends with sentence punctuation or is a list or heading', () => {
    const chunkA1 = 'Sentence one.\n\nSentence two concludes here.';
    const chunkA2 = 'Sentence two concludes here with additional commentary.';
    expect(assembleCleanedChunks([chunkA1, chunkA2])).toBe(
      'Sentence one.\n\nSentence two concludes here.\n\nSentence two concludes here with additional commentary.',
    );

    const chunkB1 = '- Item that is long enough to exceed fifteen chars';
    const chunkB2 = '- Item that is long enough to exceed fifteen chars and continues';
    expect(assembleCleanedChunks([chunkB1, chunkB2])).toBe(
      '- Item that is long enough to exceed fifteen chars\n\n- Item that is long enough to exceed fifteen chars and continues',
    );
  });

  it('deduplicates seam heading across different markdown formatting styles (### vs bold **)', () => {
    const chunk1 = '## Section 6\n\nPrevious section content.\n\n### 7. Rating Components';
    const chunk2 =
      '**7. Rating Components**\n\nThe following rating criteria apply to all submissions.';

    const assembled = assembleCleanedChunks([chunk1, chunk2]);

    expect(assembled).toBe(
      '## Section 6\n\nPrevious section content.\n\n### 7. Rating Components\n\nThe following rating criteria apply to all submissions.',
    );
  });

  it('deduplicates seam title with bold in assembled and plain or heading in nextChunk', () => {
    const chunk1 = 'Some previous text.\n\n**7. Rating Components**';
    const chunk2 =
      '7. Rating Components\n\nThe following rating criteria apply to all submissions.';

    const assembled = assembleCleanedChunks([chunk1, chunk2]);

    expect(assembled).toBe(
      'Some previous text.\n\n**7. Rating Components**\n\nThe following rating criteria apply to all submissions.',
    );
  });
});

describe('CleanupImportWithAiUseCase — chunked cleanup', () => {
  it('cleans a document beyond the model document cap as sequential section requests', async () => {
    const prompts: string[] = [];
    const mockAiService: AiService = {
      async *streamChat(request: AiChatRequest): AsyncIterable<AiStreamEvent> {
        const prompt = sectionPrompt(request);
        prompts.push(prompt);
        yield { type: 'token', text: `cleaned-${prompts.length}` };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const markdown = bigDocument();
    const useCase = new CleanupImportWithAiUseCase(mockAiService, 0);
    const result = await useCase.execute({ markdown, title: 'Big Doc' });

    expect(prompts).toHaveLength(2);
    expect(result.original).toBe(markdown);
    expect(result.cleaned).toBe('cleaned-1\n\ncleaned-2');

    // Each request carries the document background and exactly one target section.
    expect(prompts[0]).toContain('<document_background>');
    expect(prompts[0]).toContain('Document Title: Big Doc');
    expect(prompts[0]).toContain('Document Outline:');
    expect(prompts[0]).toContain('## Section 0');
    expect(prompts[0]).toContain('This is Section 1 of 2.');
    expect(prompts[0]).toContain('Retain document title if present.');
    expect(prompts[0]).toContain('standard GitHub-Flavored Markdown tables with pipe columns');
    expect(prompts[0]).toContain('Preserve list numbering and bullet hierarchy');
    expect(prompts[1]).toContain('This is Section 2 of 2.');
    expect(prompts[1]).toContain('Do NOT output a document title');
    expect(prompts[1]).not.toContain('Retain document title if present.');

    // The target section is the document's own text, unwrapped from the prompt.
    const target = prompts[1].split('<target_section_to_clean>')[1].split('</target_section_to_clean>')[0];
    expect(markdown).toContain(target.trim());
  });

  it('deduplicates a heading the model repeated across a section boundary', async () => {
    let calls = 0;
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        calls += 1;
        yield {
          type: 'token',
          text: calls === 1 ? '# Big Doc\n\n## Section 0\n\nalpha\n\n## Section 1' : '## Section 1\n\nbeta',
        };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService, 0);
    const result = await useCase.execute({ markdown: bigDocument() });

    expect(result.cleaned).toBe('# Big Doc\n\n## Section 0\n\nalpha\n\n## Section 1\n\nbeta');
  });

  it('reports progress before each section request', async () => {
    const updates: AiCleanupProgress[] = [];
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'token', text: 'cleaned' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService, 0);
    await useCase.execute({
      markdown: bigDocument(),
      onProgress: (progress) => updates.push(progress),
    });

    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({
      phase: 'cleaning',
      current: 1,
      total: 2,
      percent: 0,
      label: 'Cleaning section 1 of 2...',
    });
    expect(updates[1]).toMatchObject({
      phase: 'cleaning',
      current: 2,
      total: 2,
      percent: 50,
      label: 'Cleaning section 2 of 2...',
    });
  });

  it('cools down and retries a rate-limited section', async () => {
    const updates: AiCleanupProgress[] = [];
    let calls = 0;
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        calls += 1;
        if (calls === 1) {
          yield {
            type: 'error',
            code: 'RATE_LIMITED',
            message: 'Rate limit reached.',
            retryAfterSeconds: 0.01,
          };
          return;
        }
        yield { type: 'token', text: 'cleaned' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService, 0);
    const result = await useCase.execute({
      markdown: bigDocument(),
      onProgress: (progress) => updates.push(progress),
    });

    expect(calls).toBe(3);
    expect(result.cleaned).toBe('cleaned\n\ncleaned');
    expect(updates.some((update) => update.phase === 'cooldown')).toBe(true);
    expect(updates.find((update) => update.phase === 'cooldown')?.label).toContain(
      'Cooling down for 1s',
    );
  });

  it('reports the cleaned sections and resumes from the failed one', async () => {
    let calls = 0;
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        calls += 1;
        if (calls === 2) throw new Error('Provider exploded');
        yield { type: 'token', text: `cleaned-${calls}` };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const markdown = bigDocument();
    const useCase = new CleanupImportWithAiUseCase(mockAiService, 0);

    await expect(useCase.execute({ markdown })).rejects.toMatchObject({
      name: 'AiCleanupPartialError',
      failedIndex: 1,
      partialChunks: ['cleaned-1'],
    });
    expect(useCase.hasPendingCleanupResume()).toBe(true);

    const resumed = await useCase.retryCleanupRemaining();

    // The first section is reused from the cache, not re-sent.
    expect(calls).toBe(3);
    expect(resumed.original).toBe(markdown);
    expect(resumed.cleaned).toBe('cleaned-1\n\ncleaned-3');
    expect(useCase.hasPendingCleanupResume()).toBe(false);
  });

  it('leaves nothing to resume when the first section is the one that fails', async () => {
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield* [];
        throw new Error('Provider exploded');
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService, 0);

    await expect(useCase.execute({ markdown: bigDocument() })).rejects.toThrow(
      'Provider exploded',
    );
    expect(useCase.hasPendingCleanupResume()).toBe(false);
    await expect(useCase.retryCleanupRemaining()).rejects.toThrow(
      'There is no interrupted AI cleanup to resume.',
    );
  });

  it('stops a chunked run when the caller aborts', async () => {
    const controller = new AbortController();
    let calls = 0;
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        calls += 1;
        controller.abort();
        yield { type: 'token', text: 'cleaned' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService, 0);

    await expect(
      useCase.execute({ markdown: bigDocument(), signal: controller.signal }),
    ).rejects.toThrow('Aborted');
    expect(calls).toBe(1);
  });

  it('cleans a document larger than the whole-document cap by splitting it', async () => {
    const descriptor = getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG);
    let calls = 0;
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        calls += 1;
        yield { type: 'token', text: `part-${calls}` };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    // One long paragraph, past the model's own document cap — impossible before chunking existed.
    const markdown = `# Long\n\n${'word '.repeat((descriptor.maxDocumentContextChars + 2_000) / 5)}`;

    const useCase = new CleanupImportWithAiUseCase(mockAiService, 0);
    const result = await useCase.execute({ markdown });

    expect(calls).toBeGreaterThan(1);
    expect(result.cleaned).toBe(
      Array.from({ length: calls }, (_, index) => `part-${index + 1}`).join('\n\n'),
    );
  });
});
