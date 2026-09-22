import type { AiService } from '../../../domain/ai/services/AiService';
import type { AiChatMessage, AiUsage } from '../../../domain/ai/models/ai.types';
import type { AiModelCatalog } from '../../../domain/ai/services/aiModelCatalog';
import {
  DEFAULT_AI_MODEL_CATALOG,
  getAiModelDescriptor,
} from '../../../domain/ai/services/aiModelCatalog';

export interface AiCleanupResult {
  /** The original Markdown (unchanged) */
  original: string;
  /** The AI-cleaned Markdown */
  cleaned: string;
}

export interface CleanupImportRequest {
  markdown: string;
  title?: string;
  model?: string;
  catalog?: AiModelCatalog;
  signal?: AbortSignal;
}

export class CleanupImportWithAiUseCase {
  private readonly aiService: AiService;

  constructor(aiService: AiService) {
    this.aiService = aiService;
  }

  async execute(request: CleanupImportRequest): Promise<AiCleanupResult>;
  async execute(
    markdown: string,
    title?: string,
    options?: { model?: string; catalog?: AiModelCatalog; signal?: AbortSignal },
  ): Promise<AiCleanupResult>;
  async execute(
    markdownOrRequest: string | CleanupImportRequest,
    title?: string,
    options?: { model?: string; catalog?: AiModelCatalog; signal?: AbortSignal },
  ): Promise<AiCleanupResult> {
    const isRequestObj = typeof markdownOrRequest !== 'string';
    const markdown = isRequestObj ? markdownOrRequest.markdown : markdownOrRequest;
    const reqTitle = isRequestObj ? markdownOrRequest.title : title;
    const model = isRequestObj ? markdownOrRequest.model : options?.model;
    const catalog = (isRequestObj ? markdownOrRequest.catalog : options?.catalog) ?? DEFAULT_AI_MODEL_CATALOG;
    const signal = isRequestObj ? markdownOrRequest.signal : options?.signal;

    const descriptor = getAiModelDescriptor(catalog, model);

    if (markdown.length > descriptor.maxDocumentContextChars) {
      throw new Error(
        'Document is too large for AI cleanup. Please edit manually or clean in smaller sections.',
      );
    }

    const systemPrompt = `Convert OCR text into clean Markdown.
DO NOT summarize. DO NOT remove information. Preserve all content.
Fix spelling only when confidence is obvious.
Use headings, lists, and tables where appropriate.
Return ONLY the cleaned Markdown, no explanations or commentary.`;

    const userPrompt = reqTitle ? `# ${reqTitle}\n\n${markdown}` : markdown;

    const messages: AiChatMessage[] = [
      {
        id: 'sys',
        role: 'system',
        content: systemPrompt,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr',
        role: 'user',
        content: userPrompt,
        createdAt: new Date().toISOString(),
      },
    ];

    let accumulatedText = '';
    let lastUsage: AiUsage | undefined;
    const stream = this.aiService.streamChat({
      messages,
      mode: 'assistant',
      model,
      signal,
    });

    for await (const event of stream) {
      if (event.type === 'token') {
        accumulatedText += event.text;
      } else if (event.type === 'done') {
        if (event.usage) {
          lastUsage = event.usage;
        }
      } else if (event.type === 'error') {
        const err = new Error(event.message) as Error & { code?: string; retryAfterSeconds?: number };
        if (event.code) err.code = event.code;
        if (typeof event.retryAfterSeconds === 'number') err.retryAfterSeconds = event.retryAfterSeconds;
        throw err;
      }
    }

    if (
      typeof lastUsage?.completionTokens === 'number' &&
      lastUsage.completionTokens >= descriptor.maxOutputTokens
    ) {
      throw new Error(
        `AI cleanup was cut off at the model output limit (${descriptor.maxOutputTokens} tokens). Original document preserved.`,
      );
    }

    let cleaned = accumulatedText.trim();
    // Strip outer markdown code fence if the LLM wrapped the entire response in ```markdown ... ```
    const fenceMatch = cleaned.match(/^```(?:markdown)?\s*([\s\S]*?)\s*```$/i);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }

    if (!cleaned) {
      throw new Error('AI cleanup returned an empty response.');
    }

    return {
      original: markdown,
      cleaned,
    };
  }
}
