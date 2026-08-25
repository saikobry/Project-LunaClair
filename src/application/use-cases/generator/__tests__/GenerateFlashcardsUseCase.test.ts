import { describe, it, expect, vi } from 'vitest';
import { GenerateFlashcardsUseCase } from '../GenerateFlashcardsUseCase';
import { BatchCreateFlashcardsUseCase } from '../BatchCreateFlashcardsUseCase';
import { MockAiAdapter } from '../../../../infrastructure/ai/MockAiAdapter';
import type { QuestionRepository, CreateQuestionInput } from '../../../../domain/quiz/QuestionRepository';
import type { Question } from '../../../../domain/quiz/Question';
import type { GeneratedFlashcardDraft } from '../../../../domain/generator/generator.types';

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
      explanation: 'Example drug: Metoprolol.',
    },
    {
      front: 'What enzyme is inhibited by Lisinopril?',
      back: 'Angiotensin-Converting Enzyme (ACE)',
      explanation: 'Prevents conversion of angiotensin I to angiotensin II.',
    },
  ];

  it('generates structured flashcards and assigns flashcard & ai-generated tags', async () => {
    const mockAi = new MockAiAdapter({
      structuredResponse: mockCardsPayload,
    });

    const useCase = new GenerateFlashcardsUseCase(mockAi);
    const result = await useCase.execute({
      materialId: 'mat-pharm-1',
      documentMarkdown: sampleMarkdown,
      count: 2,
    });

    expect(result).toHaveLength(2);
    expect(result[0].front).toContain('Beta Blockers');
    expect(result[0].back).toContain('Antagonize');
    expect(result[0].tags).toContain('flashcard');
    expect(result[0].tags).toContain('ai-generated');
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
    expect(capturedInputs[0].tags).toContain('flashcard');
    expect(capturedInputs[0].tags).toContain('ai-generated');
  });
});
