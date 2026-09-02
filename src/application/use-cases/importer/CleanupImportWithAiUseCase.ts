import type { AiService } from '../../../domain/ai/services/AiService';
import type { AiChatMessage } from '../../../domain/ai/models/ai.types';

export interface AiCleanupResult {
  /** The original Markdown (unchanged) */
  original: string;
  /** The AI-cleaned Markdown */
  cleaned: string;
}

export class CleanupImportWithAiUseCase {
  private readonly aiService: AiService;

  constructor(aiService: AiService) {
    this.aiService = aiService;
  }

  async execute(markdown: string, title?: string): Promise<AiCleanupResult> {
    const systemPrompt = `Convert OCR text into clean Markdown.
DO NOT summarize. DO NOT remove information. Preserve all content.
Fix spelling only when confidence is obvious.
Use headings, lists, and tables where appropriate.
Return ONLY the cleaned Markdown, no explanations or commentary.`;

    const userPrompt = title ? `# ${title}\n\n${markdown}` : markdown;

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
    const stream = this.aiService.streamChat({
      messages,
      mode: 'assistant',
    });

    for await (const event of stream) {
      if (event.type === 'token') {
        accumulatedText += event.text;
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    }

    let cleaned = accumulatedText.trim();
    // Strip outer markdown code fence if the LLM wrapped the entire response in ```markdown ... ```
    const fenceMatch = cleaned.match(/^```(?:markdown)?\s*([\s\S]*?)\s*```$/i);
    if (fenceMatch && fenceMatch[1]) {
      cleaned = fenceMatch[1].trim();
    }

    return {
      original: markdown,
      cleaned: cleaned || markdown,
    };
  }
}
