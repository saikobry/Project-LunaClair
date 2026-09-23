import { describe, it, expect, vi } from 'vitest';
import { AI_VISION_SYSTEM_PROMPT, AiVisionExtractor } from '../AiVisionExtractor';
import type { AiService } from '../../../../domain/ai/services/AiService';
import type { AiStreamEvent } from '../../../../domain/ai/models/ai.types';

describe('AiVisionExtractor', () => {
  const sampleDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/';

  function createMockAiService(events: AiStreamEvent[]): AiService {
    return {
      async *streamChat() {
        for (const event of events) {
          yield event;
        }
      },
      generateStructured: vi.fn(),
    };
  }

  it('transcribes document page image into clean Markdown PageExtraction', async () => {
    const events: AiStreamEvent[] = [
      { type: 'start', messageId: 'msg-1' },
      { type: 'token', text: '# Chapter 1\n\n' },
      { type: 'token', text: '| Item | Price |\n| --- | --- |\n| Apple | $1.00 |' },
      {
        type: 'done',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'ukisai-swift-max',
      },
    ];

    const aiService = createMockAiService(events);
    const extractor = new AiVisionExtractor(aiService);

    const result = await extractor.extractPageFromDataUrl(sampleDataUrl, 1);

    expect(result).toEqual({
      pageNumber: 1,
      text: '# Chapter 1\n\n| Item | Price |\n| --- | --- |\n| Apple | $1.00 |',
      confidence: 95,
      source: 'ai-vision',
    });
  });

  it('strips markdown code fences wrapping the entire output', async () => {
    const events: AiStreamEvent[] = [
      { type: 'start', messageId: 'msg-1' },
      { type: 'token', text: '```markdown\n## Heading 2\n\nParagraph text.\n```' },
      {
        type: 'done',
        usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
      },
    ];

    const aiService = createMockAiService(events);
    const extractor = new AiVisionExtractor(aiService);

    const result = await extractor.extractPageFromDataUrl(sampleDataUrl, 2);

    expect(result.text).toBe('## Heading 2\n\nParagraph text.');
    expect(result.source).toBe('ai-vision');
  });

  it('throws truncation error if completionTokens reaches maxOutputTokens', async () => {
    const events: AiStreamEvent[] = [
      { type: 'start', messageId: 'msg-1' },
      { type: 'token', text: 'Incomplete content that got cut off...' },
      {
        type: 'done',
        usage: { promptTokens: 200, completionTokens: 4096, totalTokens: 4296 },
      },
    ];

    const aiService = createMockAiService(events);
    const extractor = new AiVisionExtractor(aiService);

    await expect(
      extractor.extractPageFromDataUrl(sampleDataUrl, 3),
    ).rejects.toThrow(/reached maximum output token limit/);
  });

  it('rejects empty text responses', async () => {
    const events: AiStreamEvent[] = [
      { type: 'start', messageId: 'msg-1' },
      { type: 'token', text: '   \n\n  ' },
      {
        type: 'done',
        usage: { promptTokens: 50, completionTokens: 2, totalTokens: 52 },
      },
    ];

    const aiService = createMockAiService(events);
    const extractor = new AiVisionExtractor(aiService);

    await expect(
      extractor.extractPageFromDataUrl(sampleDataUrl, 1),
    ).rejects.toThrow(/extracted no text from page 1/);
  });

  it('throws error if selected model does not support vision', async () => {
    const aiService = createMockAiService([]);
    const extractor = new AiVisionExtractor(aiService);

    await expect(
      extractor.extractPageFromDataUrl(sampleDataUrl, 1, { model: 'cf-llama-3.3-70b' }),
    ).rejects.toThrow(/does not support vision/);
  });

  it('propagates stream error events with code and retryAfterSeconds', async () => {
    const events: AiStreamEvent[] = [
      {
        type: 'error',
        code: 'RATE_LIMITED',
        message: 'Rate limit: 5 prompts per minute. Try again in 12s.',
        retryAfterSeconds: 12,
      },
    ];

    const aiService = createMockAiService(events);
    const extractor = new AiVisionExtractor(aiService);

    try {
      await extractor.extractPageFromDataUrl(sampleDataUrl, 1);
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe('RATE_LIMITED');
      expect((err as { retryAfterSeconds?: number }).retryAfterSeconds).toBe(12);
    }
  });

  it('aborts when signal is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    const aiService = createMockAiService([]);
    const extractor = new AiVisionExtractor(aiService);

    await expect(
      extractor.extractPageFromDataUrl(sampleDataUrl, 1, { signal: controller.signal }),
    ).rejects.toThrow('Aborted');
  });

  it('passes the verbatim visual transcription system prompt to streamChat', async () => {
    const events: AiStreamEvent[] = [
      { type: 'start', messageId: 'msg-1' },
      { type: 'token', text: 'Hello' },
      {
        type: 'done',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ];

    const aiService = createMockAiService(events);
    const streamChatSpy = vi.spyOn(aiService, 'streamChat');
    const extractor = new AiVisionExtractor(aiService);

    await extractor.extractPageFromDataUrl(sampleDataUrl, 1);

    expect(streamChatSpy).toHaveBeenCalledOnce();
    const request = streamChatSpy.mock.calls[0]?.[0];
    expect(request?.messages[0]?.content).toBe(AI_VISION_SYSTEM_PROMPT);
  });

  it('includes table formatting, list preservation, and page furniture rules in system prompt', () => {
    expect(AI_VISION_SYSTEM_PROMPT).toContain('standard GitHub-Flavored Markdown tables with pipes (|)');
    expect(AI_VISION_SYSTEM_PROMPT).toContain('Do NOT convert numbered policy clauses or list items into Markdown headings');
    expect(AI_VISION_SYSTEM_PROMPT).toContain('Omit obvious recurring document-control running headers');
  });
});
