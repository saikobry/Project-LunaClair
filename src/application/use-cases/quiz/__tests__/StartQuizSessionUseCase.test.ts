import { describe, expect, it, vi } from 'vitest';
import { StartQuizSessionUseCase } from '../StartQuizSessionUseCase';
import type { QuizSession } from '../../../../domain/quiz/models/QuizSession';
import type { CreateSessionInput, QuizSessionRepository } from '../../../../domain/quiz/repositories/QuizSessionRepository';
import type { Question } from '../../../../domain/quiz/models/Question';

describe('StartQuizSessionUseCase', () => {
    const mockQuestion: Question = {
        id: 'q1',
        materialId: 'mat-1',
        type: 'multiple_choice',
        prompt: 'What is 2 + 2?',
        payload: {
            type: 'multiple_choice',
            choices: ['3', '4', '5'],
            correctIndex: 1,
        },
        points: 5,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const sampleInput: CreateSessionInput = {
        source: 'stored',
        quizId: 'quiz-101',
        mode: 'practice',
    };

    it('creates and returns a new in-progress quiz session', async () => {
        const createdSession: QuizSession = {
            id: 'sess-123',
            quizId: 'quiz-101',
            mode: 'practice',
            status: 'in_progress',
            questionSnapshots: { q1: mockQuestion },
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
        };

        const mockRepo: QuizSessionRepository = {
            createSession: vi.fn().mockResolvedValue(createdSession),
            getSessions: vi.fn(),
            getAllCompletedSessions: vi.fn(),
            getSessionById: vi.fn(),
            completeSession: vi.fn(),
            deleteSession: vi.fn(),
        };

        const useCase = new StartQuizSessionUseCase(mockRepo);
        const result = await useCase.execute(sampleInput);

        expect(mockRepo.createSession).toHaveBeenCalledWith(sampleInput);
        expect(result).toEqual(createdSession);
        expect(result.status).toBe('in_progress');
    });

    it('propagates repository errors when session creation fails', async () => {
        const mockRepo: QuizSessionRepository = {
            createSession: vi.fn().mockRejectedValue(new Error('IndexedDB quota exceeded')),
            getSessions: vi.fn(),
            getAllCompletedSessions: vi.fn(),
            getSessionById: vi.fn(),
            completeSession: vi.fn(),
            deleteSession: vi.fn(),
        };

        const useCase = new StartQuizSessionUseCase(mockRepo);
        await expect(useCase.execute(sampleInput)).rejects.toThrow('IndexedDB quota exceeded');
    });
});
