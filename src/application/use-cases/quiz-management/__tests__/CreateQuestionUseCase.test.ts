import { describe, expect, it, vi } from 'vitest';
import { CreateQuestionUseCase } from '../CreateQuestionUseCase';
import type { QuestionRepository, CreateQuestionInput } from '../../../../domain/quiz/QuestionRepository';
import type { Question } from '../../../../domain/quiz/Question';

describe('CreateQuestionUseCase', () => {
    const mockQuestion: Question = {
        id: 'q100',
        materialId: 'mat-1',
        type: 'true_false',
        prompt: 'Mitochondria are the powerhouse of the cell.',
        payload: { type: 'true_false', correctAnswer: true },
        points: 5,
        difficulty: 'easy',
        version: 1,
        status: 'draft',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('creates question defaulting status to draft', async () => {
        const mockRepo: QuestionRepository = {
            createQuestion: vi.fn().mockImplementation((input) =>
                Promise.resolve({
                    ...mockQuestion,
                    ...input,
                    id: 'q-new',
                }),
            ),
            getQuestions: vi.fn(),
            getQuestionById: vi.fn(),
            getQuestionsByIds: vi.fn(),
            createQuestionsBatch: vi.fn(),
            updateQuestion: vi.fn(),
            deleteQuestion: vi.fn(),
        };

        const useCase = new CreateQuestionUseCase(mockRepo);

        const input: CreateQuestionInput = {
            materialId: 'mat-1',
            type: 'true_false',
            prompt: 'Mitochondria are the powerhouse of the cell.',
            payload: { type: 'true_false', correctAnswer: true },
            points: 5,
            difficulty: 'easy',
        };

        const result = await useCase.execute(input);

        expect(mockRepo.createQuestion).toHaveBeenCalledWith({
            ...input,
            status: 'draft',
        });
        expect(result.status).toBe('draft');
    });
});
