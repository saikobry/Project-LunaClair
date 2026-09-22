import type { AiService } from '../../../domain/ai/services/AiService';
import type {
  GenerateFlashcardsRequest,
  GeneratedFlashcardDraft,
} from '../../../domain/generator/models/generator.types';
import { AiGenerationError } from '../../../domain/ai/models/ai.types';
import {
  DEFAULT_AI_MODEL_CATALOG,
  getAiModelDescriptor,
} from '../../../domain/ai/services/aiModelCatalog';
import {
  validateFlashcardsDraftArray,
  type DraftBatch,
} from '../../../domain/generator/validation/questionDraftValidation';
import { extractSectionContext } from '../../../domain/ai/context/extractSectionContext';
import type { AiGroundingResolver } from '../ai/AiGroundingResolver';

export class GenerateFlashcardsUseCase {
  private readonly aiService: AiService;
  private readonly groundingResolver: AiGroundingResolver;

  constructor(aiService: AiService, groundingResolver: AiGroundingResolver) {
    this.aiService = aiService;
    this.groundingResolver = groundingResolver;
  }

  async execute(request: GenerateFlashcardsRequest): Promise<DraftBatch<GeneratedFlashcardDraft>> {
    const count = Math.max(1, Math.min(15, request.count ?? 8));

    // Same contract as question generation: the document is the material's, resolved here.
    const snapshot = await this.groundingResolver.resolve(
      { materialId: request.materialId, grounding: 'whole' },
      { model: request.model, signal: request.signal },
    );
    const sourceMarkdown = snapshot.documentContext?.markdown;
    if (!sourceMarkdown) {
      throw new AiGenerationError(
        'This material has no readable content to generate flashcards from.',
        'EMPTY_DOCUMENT',
      );
    }

    const descriptor = getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, request.model);

    const { contextText, sectionHeading } = extractSectionContext(
      sourceMarkdown,
      undefined,
      { maxCharacters: descriptor.maxDocumentContextChars },
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
4. TAGS: give every card 2-4 short topic tags (lowercase, one to three words) naming the subject matter it tests, drawn from the material — these are how a user classifies the card later. Never tag a card with how it was produced (for example 'ai', 'generated', or 'flashcard').

Output a STRICT JSON ARRAY of flashcard objects without markdown code fences or conversational text.

SCHEMA:
[
  {
    "front": "What organelle produces ATP via cellular respiration?",
    "back": "Mitochondria",
    "tags": ["cell biology", "organelles"],
    "explanation": "Known as the powerhouse of eukaryotic cells."
  }
]`;

    const userPrompt = `Study Material Content:
---
${contextText}
---

Generate ${count} atomic flashcards matching the schema.`;

    const rawBatch = await this.aiService.generateStructured(
      {
        systemPrompt,
        userPrompt,
        temperature: 0.4,
        maxTokens: descriptor.maxOutputTokens,
        model: request.model,
        signal: request.signal,
      },
      validateFlashcardsDraftArray,
    );

    // Same salvage contract as question generation: valid cards are kept, drops are reported. Tags
    // are the model's own topic classification — no provenance markers are stamped on top.
    return {
      drafts: rawBatch.drafts.map((draft) => ({
        ...draft,
        tags: draft.tags ?? [],
        sourceSection: sectionHeading || draft.sourceSection,
      })),
      rejected: rawBatch.rejected,
    };
  }
}
