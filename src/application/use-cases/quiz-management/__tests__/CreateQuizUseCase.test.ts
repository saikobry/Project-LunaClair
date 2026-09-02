import { describe, expect, it, vi } from 'vitest';
import { CreateQuizUseCase } from '../CreateQuizUseCase';
import type { QuizRepository, CreateQuizInput } from '../../../../domain/quiz/repositories/QuizRepository';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';

describe('CreateQuizUseCase', () => {
    const mockQuestion1: Question = {
        id: 'q1',
        materialId: 'mat-1',
        type: 'multiple_choice',
        prompt: 'Question 1',
        payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
        points: 5,
        difficulty: 'easy',
        version: 3,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockQuiz: Quiz = {
        id: 'quiz-1',
        materialId: 'mat-1',
        title: 'Sample Quiz',
        status: 'draft',
        questionIds: ['q1'],
        items: [{ quizId: 'quiz-1', questionId: 'q1', questionVersion: 3, order: 1, points: 5 }],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('creates a new quiz in draft status with matched question versions and item orders', async () => {
        const mockRepo: QuizRepository = {
            createQuiz: vi.fn().mockResolvedValue(mockQuiz),
            getQuizById: vi.fn(),
            getQuizzes: vi.fn(),
            getQuizzesForMaterials: vi.fn(),
            getQuizzesByIds: vi.fn(),
            updateQuiz: vi.fn(),
            deleteQuiz: vi.fn(),
        };

        const useCase = new CreateQuizUseCase(mockRepo);

        const input: CreateQuizInput = {
            materialId: 'mat-1',
            title: 'New Bio Quiz',
            questionIds: ['q1', 'q-missing'],
        };

        const questions: Question[] = [mockQuestion1];

        await useCase.execute(input, questions);

        expect(mockRepo.createQuiz).toHaveBeenCalledWith({
            materialId: 'mat-1',
            title: 'New Bio Quiz',
            questionIds: ['q1', 'q-missing'],
            status: 'draft',
            items: [
                { quizId: '', questionId: 'q1', questionVersion: 3, order: 1, points: 5 },
                { quizId: '', questionId: 'q-missing', questionVersion: 1, order: 2, points: undefined },
            ],
        });
    });
});
