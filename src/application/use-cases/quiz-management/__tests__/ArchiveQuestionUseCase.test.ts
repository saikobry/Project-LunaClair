import { describe, expect, it, vi } from 'vitest';
import { ArchiveQuestionUseCase } from '../ArchiveQuestionUseCase';
import type { QuestionRepository } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { Question } from '../../../../domain/quiz/models/Question';

describe('ArchiveQuestionUseCase', () => {
    const mockQuestion: Question = {
        id: 'q100',
        materialId: 'mat-1',
        type: 'true_false',
        prompt: 'Mitochondria are the powerhouse of the cell.',
        payload: { type: 'true_false', correctAnswer: true },
        points: 5,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('updates question status to archived', async () => {
        const mockRepo: QuestionRepository = {
            updateQuestion: vi.fn().mockResolvedValue({ ...mockQuestion, status: 'archived' }),
            getQuestions: vi.fn(),
            getQuestionById: vi.fn(),
            getQuestionsByIds: vi.fn(),
            createQuestion: vi.fn(),
            createQuestionsBatch: vi.fn(),
            deleteQuestion: vi.fn(),
        };

        const useCase = new ArchiveQuestionUseCase(mockRepo);
        const result = await useCase.execute('q100');

        expect(mockRepo.updateQuestion).toHaveBeenCalledWith('q100', { status: 'archived' });
        expect(result.status).toBe('archived');
    });
});
