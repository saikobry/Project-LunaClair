import { describe, expect, it, vi } from 'vitest';
import { UpdateQuestionUseCase } from '../UpdateQuestionUseCase';
import type { QuestionRepository, UpdateQuestionInput } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { Question } from '../../../../domain/quiz/models/Question';

describe('UpdateQuestionUseCase', () => {
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

    it('updates prompt and points fields', async () => {
        const mockRepo: QuestionRepository = {
            updateQuestion: vi.fn().mockImplementation((id, input) =>
                Promise.resolve({
                    ...mockQuestion,
                    id,
                    ...input,
                    updatedAt: '2026-09-01T12:00:00.000Z',
                }),
            ),
            getQuestions: vi.fn(),
            getQuestionById: vi.fn(),
            getQuestionsByIds: vi.fn(),
            createQuestion: vi.fn(),
            createQuestionsBatch: vi.fn(),
            deleteQuestion: vi.fn(),
        };

        const useCase = new UpdateQuestionUseCase(mockRepo);

        const input: UpdateQuestionInput = {
            prompt: 'Updated question prompt',
            points: 10,
        };

        const result = await useCase.execute('q100', input);

        expect(mockRepo.updateQuestion).toHaveBeenCalledWith('q100', input);
        expect(result.prompt).toBe('Updated question prompt');
        expect(result.points).toBe(10);
    });
});
