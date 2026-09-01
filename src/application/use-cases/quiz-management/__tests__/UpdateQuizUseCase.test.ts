import { describe, expect, it, vi } from 'vitest';
import { UpdateQuizUseCase } from '../UpdateQuizUseCase';
import type { QuizRepository } from '../../../../domain/quiz/QuizRepository';
import type { Quiz } from '../../../../domain/quiz/Quiz';

describe('UpdateQuizUseCase', () => {
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

    it('updates quiz title and description fields', async () => {
        const mockRepo: QuizRepository = {
            updateQuiz: vi.fn().mockImplementation((id, input) =>
                Promise.resolve({
                    ...mockQuiz,
                    id,
                    ...input,
                    updatedAt: '2026-09-01T12:00:00.000Z',
                }),
            ),
            getQuizById: vi.fn(),
            getQuizzes: vi.fn(),
            getQuizzesForMaterials: vi.fn(),
            getQuizzesByIds: vi.fn(),
            createQuiz: vi.fn(),
            deleteQuiz: vi.fn(),
        };

        const useCase = new UpdateQuizUseCase(mockRepo);

        const result = await useCase.execute('quiz-1', {
            title: 'Updated Title',
            description: 'Updated Description',
        });

        expect(mockRepo.updateQuiz).toHaveBeenCalledWith('quiz-1', {
            title: 'Updated Title',
            description: 'Updated Description',
        });
        expect(result.title).toBe('Updated Title');
        expect(result.description).toBe('Updated Description');
    });
});
