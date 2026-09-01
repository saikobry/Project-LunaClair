import { describe, expect, it, vi } from 'vitest';
import { PublishQuizUseCase } from '../PublishQuizUseCase';
import type { QuizRepository } from '../../../../domain/quiz/QuizRepository';
import type { Quiz } from '../../../../domain/quiz/Quiz';

describe('PublishQuizUseCase', () => {
    const mockQuiz: Quiz = {
        id: 'quiz-1',
        materialId: 'mat-1',
        title: 'Sample Quiz',
        status: 'draft',
        questionIds: ['q1'],
        items: [],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('updates quiz status to published', async () => {
        const mockRepo: QuizRepository = {
            updateQuiz: vi.fn().mockResolvedValue({ ...mockQuiz, status: 'published' }),
            getQuizById: vi.fn(),
            getQuizzes: vi.fn(),
            getQuizzesForMaterials: vi.fn(),
            getQuizzesByIds: vi.fn(),
            createQuiz: vi.fn(),
            deleteQuiz: vi.fn(),
        };

        const useCase = new PublishQuizUseCase(mockRepo);
        const result = await useCase.execute('quiz-1');

        expect(mockRepo.updateQuiz).toHaveBeenCalledWith('quiz-1', { status: 'published' });
        expect(result.status).toBe('published');
    });
});
