import { describe, it, expect, vi } from 'vitest';
import { BatchCreateQuestionsUseCase } from '../BatchCreateQuestionsUseCase';
import type { QuestionRepository, CreateQuestionInput } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { GeneratedQuestionDraft } from '../../../../domain/generator/models/generator.types';

describe('BatchCreateQuestionsUseCase', () => {
  const mockDrafts: GeneratedQuestionDraft[] = [
    {
      type: 'multiple_choice',
      prompt: 'What is the powerhouse of the cell?',
      payload: {
        type: 'multiple_choice',
        choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'],
        correctIndex: 1,
      },
      difficulty: 'easy',
      points: 1,
      explanation: 'Mitochondria produce ATP.',
      tags: ['bio'],
    },
  ];

  it('persists drafts in batch defaulting to draft status and adding ai-generated tag', async () => {
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
          id: `q-${i}`,
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

    const useCase = new BatchCreateQuestionsUseCase(mockRepo);
    const result = await useCase.execute({
      materialId: 'mat-cell-1',
      questions: mockDrafts,
    });

    expect(result).toHaveLength(1);
    expect(capturedInputs).toHaveLength(1);
    expect(capturedInputs[0].materialId).toBe('mat-cell-1');
    expect(capturedInputs[0].status).toBe('draft');
    expect(capturedInputs[0].tags).toContain('ai-generated');
    expect(capturedInputs[0].tags).toContain('bio');
  });

  it('returns empty array when input array is empty without invoking repository', async () => {
    const mockRepo: QuestionRepository = {
      getQuestions: vi.fn(),
      getQuestionById: vi.fn(),
      getQuestionsByIds: vi.fn(),
      createQuestion: vi.fn(),
      createQuestionsBatch: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
    };

    const useCase = new BatchCreateQuestionsUseCase(mockRepo);
    const result = await useCase.execute({
      materialId: 'mat-cell-1',
      questions: [],
    });

    expect(result).toEqual([]);
    expect(mockRepo.createQuestionsBatch).not.toHaveBeenCalled();
  });
});
