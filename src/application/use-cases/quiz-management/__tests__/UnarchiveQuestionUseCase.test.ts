import { describe, expect, it, vi } from 'vitest';
import { UnarchiveQuestionUseCase } from '../UnarchiveQuestionUseCase';
import type { QuestionRepository } from '../../../../domain/quiz/QuestionRepository';
import type { Question } from '../../../../domain/quiz/Question';

describe('UnarchiveQuestionUseCase', () => {
    const mockQuestion: Question = {
        id: 'q100',
        materialId: 'mat-1',
        type: 'true_false',
        prompt: 'Mitochondria are the powerhouse of the cell.',
        payload: { type: 'true_false', correctAnswer: true },
        points: 5,
        difficulty: 'easy',
        version: 1,
        status: 'archived',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('updates question status back to draft', async () => {
        const mockRepo: QuestionRepository = {
            updateQuestion: vi.fn().mockResolvedValue({ ...mockQuestion, status: 'draft' }),
            getQuestions: vi.fn(),
            getQuestionById: vi.fn(),
            getQuestionsByIds: vi.fn(),
            createQuestion: vi.fn(),
            createQuestionsBatch: vi.fn(),
            deleteQuestion: vi.fn(),
        };

        const useCase = new UnarchiveQuestionUseCase(mockRepo);
        const result = await useCase.execute('q100');

        expect(mockRepo.updateQuestion).toHaveBeenCalledWith('q100', { status: 'draft' });
        expect(result.status).toBe('draft');
    });
});
