import { describe, it, expect, vi } from 'vitest';
import { GenerateFlashcardsUseCase } from '../GenerateFlashcardsUseCase';
import { BatchCreateFlashcardsUseCase } from '../BatchCreateFlashcardsUseCase';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import {
  DEFAULT_AI_MODEL_CATALOG,
  getAiModelDescriptor,
} from '../../../../domain/ai/services/aiModelCatalog';
import type { AiGenerationRequest } from '../../../../domain/ai/models/ai.types';
import type { AiGroundingResolver } from '../../ai/AiGroundingResolver';
import type { QuestionRepository, CreateQuestionInput } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { GeneratedFlashcardDraft } from '../../../../domain/generator/models/generator.types';

describe('GenerateFlashcardsUseCase and BatchCreateFlashcardsUseCase', () => {
  const sampleMarkdown = `
# Pharmacology: Cardiovascular Drugs
Beta blockers like Metoprolol decrease heart rate and cardiac output by antagonizing beta-1 receptors.
ACE inhibitors like Lisinopril block conversion of angiotensin I to II, decreasing systemic vascular resistance.
  `.trim();

  const mockCardsPayload: GeneratedFlashcardDraft[] = [
    {
      front: 'What is the primary mechanism of action of Beta Blockers?',
      back: 'Antagonize beta-1 adrenergic receptors to decrease heart rate and cardiac output.',
      tags: ['beta blockers', 'cardiovascular'],
      explanation: 'Example drug: Metoprolol.',
    },
    {
      front: 'What enzyme is inhibited by Lisinopril?',
      back: 'Angiotensin-Converting Enzyme (ACE)',
      explanation: 'Prevents conversion of angiotensin I to angiotensin II.',
    },
  ];

  /**
   * Stands in for `AiGroundingResolver`. `markdown: undefined` models a material whose document
   * resolves to nothing, which synthesis must refuse rather than prompt on empty text.
   */
  function stubResolver(markdown: string | undefined): AiGroundingResolver {
    return {
      resolve: async () => ({
        mode: 'whole' as const,
        materialId: 'mat-pharm-1',
        ...(markdown
          ? { documentContext: { id: 'document-mat-pharm-1', title: 'Pharmacology', markdown } }
          : {}),
        documentCharacters: markdown?.length ?? 0,
      }),
    } as unknown as AiGroundingResolver;
  }

  /** Records what the adapter was actually asked for, then delegates to the real mock. */
  function recordRequests(mockAi: MockAiAdapter): AiGenerationRequest[] {
    const seen: AiGenerationRequest[] = [];
    const original = mockAi.generateStructured.bind(mockAi);
    mockAi.generateStructured = (request, validator) => {
      seen.push(request);
      return original(request, validator);
    };
    return seen;
  }

  it('generates structured flashcards and keeps the model topic tags without adding provenance markers', async () => {
    const mockAi = new MockAiAdapter({
      structuredResponse: mockCardsPayload,
    });

    const useCase = new GenerateFlashcardsUseCase(mockAi, stubResolver(sampleMarkdown));
    const batch = await useCase.execute({
      materialId: 'mat-pharm-1',
      count: 2,
    });

    expect(batch.drafts).toHaveLength(2);
    expect(batch.rejected).toEqual([]);
    expect(batch.drafts[0].front).toContain('Beta Blockers');
    expect(batch.drafts[0].back).toContain('Antagonize');
    // Tags classify subject matter. Nothing about how the card was authored is stamped on top:
    // an `ai-generated` marker does not help anyone find or group a card.
    expect(batch.drafts[0].tags).toEqual(['beta blockers', 'cardiovascular']);
    expect(batch.drafts[0].tags).not.toContain('ai-generated');
    expect(batch.drafts[0].tags).not.toContain('flashcard');
  });

  it('keeps the valid cards and reports the malformed ones', async () => {
    const mixedPayload = [
      mockCardsPayload[0],
      { front: 'Blank back', back: '   ' },
      mockCardsPayload[1],
    ];
    const mockAi = new MockAiAdapter({ structuredResponse: mixedPayload });

    const useCase = new GenerateFlashcardsUseCase(mockAi, stubResolver(sampleMarkdown));
    const batch = await useCase.execute({ materialId: 'mat-pharm-1', count: 3 });

    expect(batch.drafts).toHaveLength(2);
    expect(batch.rejected).toEqual([
      { index: 1, error: 'requires non-empty front and back text' },
    ]);
  });

  it('prompts with the resolved material document and forwards the requested model', async () => {
    const mockAi = new MockAiAdapter({ structuredResponse: mockCardsPayload });
    const seen = recordRequests(mockAi);

    const useCase = new GenerateFlashcardsUseCase(mockAi, stubResolver(sampleMarkdown));
    await useCase.execute({ materialId: 'mat-pharm-1', model: 'ukisai-swift-max' });

    expect(seen[0].userPrompt).toContain('Metoprolol');
    expect(seen[0].model).toBe('ukisai-swift-max');
    expect(seen[0].maxTokens).toBe(
      getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, 'ukisai-swift-max').maxOutputTokens,
    );
  });

  it('carries the topic focus in the system prompt, and omits the line when none is given', async () => {
    const mockAi = new MockAiAdapter({ structuredResponse: mockCardsPayload });
    const seen = recordRequests(mockAi);

    const useCase = new GenerateFlashcardsUseCase(mockAi, stubResolver(sampleMarkdown));
    await useCase.execute({ materialId: 'mat-pharm-1', focusTopic: 'beta blockers' });

    // Focus is prompt content rather than a request field, so the prompt is the only place it is
    // observable — there is nothing on the wire to assert it against.
    expect(seen[0].systemPrompt).toContain('- Specific Topic Focus: beta blockers');
    // It narrows the authoring instruction; it does not change what the request is grounded in.
    expect(seen[0].userPrompt).toContain('Metoprolol');

    await useCase.execute({ materialId: 'mat-pharm-1' });

    expect(seen[1].systemPrompt).not.toContain('Specific Topic Focus');
  });

  it('refuses to generate when the material resolves to no readable content', async () => {
    const mockAi = new MockAiAdapter({ structuredResponse: mockCardsPayload });
    const seen = recordRequests(mockAi);

    const useCase = new GenerateFlashcardsUseCase(mockAi, stubResolver(undefined));

    await expect(useCase.execute({ materialId: 'mat-pharm-1' })).rejects.toMatchObject({
      code: 'EMPTY_DOCUMENT',
    });
    expect(seen).toHaveLength(0);
  });

  it('persists flashcards atomically into QuestionRepository as canonical identification questions', async () => {
    let capturedInputs: CreateQuestionInput[] = [];

    const mockRepo: QuestionRepository = {
      getQuestions: vi.fn(),
      getQuestionById: vi.fn(),
      getQuestionsByIds: vi.fn(),
      createQuestion: vi.fn(),
      createQuestionsBatch: vi.fn(async (inputs: CreateQuestionInput[]): Promise<Question[]> => {
        capturedInputs = inputs;
        return inputs.map((inp, i) => ({
          ...inp,
          id: `q-card-${i}`,
          difficulty: inp.difficulty ?? 'medium',
          points: inp.points ?? 1,
          status: inp.status ?? 'draft',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      }),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
    };

    const batchUseCase = new BatchCreateFlashcardsUseCase(mockRepo);
    const saved = await batchUseCase.execute({
      materialId: 'mat-pharm-1',
      flashcards: mockCardsPayload,
    });

    expect(saved).toHaveLength(2);
    expect(capturedInputs).toHaveLength(2);
    expect(capturedInputs[0].type).toBe('identification');
    expect(capturedInputs[0].prompt).toBe(mockCardsPayload[0].front);
    expect((capturedInputs[0].payload as any).correctAnswer).toBe(mockCardsPayload[0].back);
    expect(capturedInputs[0].tags).toEqual(['beta blockers', 'cardiovascular']);
  });
});
