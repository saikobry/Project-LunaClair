import type { AiService } from '../../../domain/ai/AiService';
import type {
  GenerateFlashcardsRequest,
  GeneratedFlashcardDraft,
} from '../../../domain/generator/generator.types';
import { validateFlashcardsDraftArray } from '../../../domain/generator/validation/questionDraftValidation';
import { extractSectionContext } from '../../../features/ai/lib/aiContextExtractor';

export class GenerateFlashcardsUseCase {
  private readonly aiService: AiService;

  constructor(aiService: AiService) {
    this.aiService = aiService;
  }

  async execute(request: GenerateFlashcardsRequest): Promise<GeneratedFlashcardDraft[]> {
    const count = Math.max(1, Math.min(15, request.count ?? 8));

    const { contextText, sectionHeading } = extractSectionContext(
      request.documentMarkdown,
      undefined,
      { maxCharacters: 12000 },
    );

    const systemPrompt = `You are an expert educator creating high-retention spaced repetition flashcards for Project LunaClair.
Your task is to synthesize ${count} clear, atomic, and high-yield flashcards grounded strictly in the provided study material.

TARGET CRITERIA:
- Count: exactly ${count} flashcards
${request.focusTopic ? `- Specific Topic Focus: ${request.focusTopic}` : ''}

FLASHCARD ATOMICITY PRINCIPLES:
1. FRONT: Clear prompt, question, or term/concept definition request. Keep it atomic (tests ONE discrete concept).
2. BACK: Concise, precise correct answer or definition.
3. EXPLANATION: Brief mnemonic or contextual detail explaining the core mechanism.

Output a STRICT JSON ARRAY of flashcard objects without markdown code fences or conversational text.

SCHEMA:
[
  {
    "front": "What organelle produces ATP via cellular respiration?",
    "back": "Mitochondria",
    "explanation": "Known as the powerhouse of eukaryotic cells."
  }
]`;

    const userPrompt = `Study Material Content:
---
${contextText}
---

Generate ${count} atomic flashcards matching the schema.`;

    const rawDrafts = await this.aiService.generateStructured(
      {
        systemPrompt,
        userPrompt,
        temperature: 0.4,
        maxTokens: 3000,
        signal: request.signal,
      },
      validateFlashcardsDraftArray,
    );

    return rawDrafts.map((draft) => {
      const tags = Array.from(
        new Set([
          'flashcard',
          'ai-generated',
          ...(draft.tags || []),
          ...(sectionHeading ? [`sec:${sectionHeading}`] : []),
        ]),
      );
      return {
        ...draft,
        tags,
        sourceSection: sectionHeading || draft.sourceSection,
      };
    });
  }
}
