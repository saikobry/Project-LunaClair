import type { AiService } from '../../../domain/ai/services/AiService';
import type { PageExtraction } from '../../../domain/importer/models/importer.types';
import type { AiChatMessage, AiUsage } from '../../../domain/ai/models/ai.types';
import {
  DEFAULT_AI_MODEL_CATALOG,
  findAiModelDescriptor,
  getAiModelDescriptor,
  type AiModelCatalog,
} from '../../../domain/ai/services/aiModelCatalog';

export interface AiVisionExtractorOptions {
  signal?: AbortSignal;
  model?: string;
  catalog?: AiModelCatalog;
}

export const AI_VISION_SYSTEM_PROMPT =
  'You are an expert document digitization system. Transcribe the document page image into clean, accurate Markdown. Preserve all visible text, headings, numbers, lists, and tables verbatim. Output ONLY the extracted Markdown content with no commentary, no conversational preamble, and no outer code fences.';

/**
 * AI-powered multimodal vision document extractor using hosted multimodal models (e.g. MAX / swift).
 * Digitizes scanned PDF / image pages directly into structured Markdown tables, headers, and text.
 */
export class AiVisionExtractor {
  private readonly aiService: AiService;

  constructor(aiService: AiService) {
    this.aiService = aiService;
  }

  /**
   * Transcribes a single document page image (JPEG data URL) into structured Markdown.
   */
  async extractPageFromDataUrl(
    jpegDataUrl: string,
    pageNumber: number,
    options?: AiVisionExtractorOptions,
  ): Promise<PageExtraction> {
    if (options?.signal?.aborted) {
      throw new Error('Aborted');
    }

    const catalog = options?.catalog ?? DEFAULT_AI_MODEL_CATALOG;
    const preferredModelId = options?.model;
    const descriptor = preferredModelId
      ? findAiModelDescriptor(catalog, preferredModelId)
      : catalog.models.find((m) => m.supportsVision) ?? getAiModelDescriptor(catalog);

    if (!descriptor) {
      throw new Error('No AI model available for vision extraction');
    }

    if (!descriptor.supportsVision) {
      throw new Error(`Model "${descriptor.id}" does not support vision`);
    }

    const messages: AiChatMessage[] = [
      {
        id: `sys-${crypto.randomUUID()}`,
        role: 'system',
        content: AI_VISION_SYSTEM_PROMPT,
        createdAt: new Date().toISOString(),
      },
      {
        id: `user-${crypto.randomUUID()}`,
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract and transcribe all text and structured formatting from this document page image verbatim.',
          },
          {
            type: 'image_url',
            image_url: { url: jpegDataUrl },
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ];

    let extractedText = '';
    let lastUsage: AiUsage | undefined;

    for await (const event of this.aiService.streamChat({
      messages,
      model: descriptor.id,
      mode: 'assistant',
      signal: options?.signal,
    })) {
      if (event.type === 'token') {
        extractedText += event.text;
      } else if (event.type === 'done') {
        if (event.usage) {
          lastUsage = event.usage;
        }
      } else if (event.type === 'error') {
        const error = new Error(event.message || `AI vision extraction failed: ${event.code}`);
        (error as { code?: string }).code = event.code;
        if (event.retryAfterSeconds !== undefined) {
          (error as { retryAfterSeconds?: number }).retryAfterSeconds = event.retryAfterSeconds;
        }
        throw error;
      }
    }

    // Page-level truncation check: if output tokens reached or exceeded the reservation ceiling
    if (
      lastUsage?.completionTokens !== undefined &&
      lastUsage.completionTokens >= descriptor.maxOutputTokens
    ) {
      throw new Error(
        `Page ${pageNumber} extraction truncated: reached maximum output token limit (${descriptor.maxOutputTokens})`,
      );
    }

    let cleaned = extractedText.trim();
    // Strip markdown code fences if output was wrapped in ```markdown ... ```
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:markdown)?\r?\n/, '').replace(/\r?\n```$/, '').trim();
    }

    if (!cleaned) {
      throw new Error(`AI Vision extracted no text from page ${pageNumber}`);
    }

    return {
      pageNumber,
      text: cleaned,
      confidence: 95,
      source: 'ai-vision',
    };
  }
}
