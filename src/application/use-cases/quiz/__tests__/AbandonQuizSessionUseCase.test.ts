import { describe, expect, it, vi } from 'vitest';
import { AbandonQuizSessionUseCase } from '../AbandonQuizSessionUseCase';
import type { QuizSession } from '../../../../domain/quiz/models/QuizSession';
import type { QuizSessionRepository } from '../../../../domain/quiz/repositories/QuizSessionRepository';

describe('AbandonQuizSessionUseCase', () => {
    it('deletes session when status is in_progress', async () => {
        const session: QuizSession = {
            id: 'sess-active',
            quizId: 'quiz-1',
            mode: 'practice',
            status: 'in_progress',
            questionSnapshots: {},
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
        };

        const mockRepo: QuizSessionRepository = {
            getSessionById: vi.fn().mockResolvedValue(session),
            getSessions: vi.fn(),
            getAllCompletedSessions: vi.fn(),
            createSession: vi.fn(),
            completeSession: vi.fn(),
            deleteSession: vi.fn().mockResolvedValue(undefined),
        };

        const useCase = new AbandonQuizSessionUseCase(mockRepo);
        await useCase.execute('sess-active');

        expect(mockRepo.getSessionById).toHaveBeenCalledWith('sess-active');
        expect(mockRepo.deleteSession).toHaveBeenCalledWith('sess-active');
    });

    it('is an idempotent no-op when session is already completed', async () => {
        const session: QuizSession = {
            id: 'sess-done',
            quizId: 'quiz-1',
            mode: 'practice',
            status: 'completed',
            questionSnapshots: {},
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
            completedAt: '2026-09-01T10:10:00.000Z',
        };

        const mockRepo: QuizSessionRepository = {
            getSessionById: vi.fn().mockResolvedValue(session),
            getSessions: vi.fn(),
            getAllCompletedSessions: vi.fn(),
            createSession: vi.fn(),
            completeSession: vi.fn(),
            deleteSession: vi.fn(),
        };

        const useCase = new AbandonQuizSessionUseCase(mockRepo);
        await useCase.execute('sess-done');

        expect(mockRepo.getSessionById).toHaveBeenCalledWith('sess-done');
        expect(mockRepo.deleteSession).not.toHaveBeenCalled();
    });

    it('is a safe no-op when session does not exist', async () => {
        const mockRepo: QuizSessionRepository = {
            getSessionById: vi.fn().mockResolvedValue(null),
            getSessions: vi.fn(),
            getAllCompletedSessions: vi.fn(),
            createSession: vi.fn(),
            completeSession: vi.fn(),
            deleteSession: vi.fn(),
        };

        const useCase = new AbandonQuizSessionUseCase(mockRepo);
        await useCase.execute('non-existent');

        expect(mockRepo.getSessionById).toHaveBeenCalledWith('non-existent');
        expect(mockRepo.deleteSession).not.toHaveBeenCalled();
    });

    it('propagates errors when deleteSession fails', async () => {
        const session: QuizSession = {
            id: 'sess-active',
            quizId: 'quiz-1',
            mode: 'practice',
            status: 'in_progress',
            questionSnapshots: {},
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
        };

        const mockRepo: QuizSessionRepository = {
            getSessionById: vi.fn().mockResolvedValue(session),
            getSessions: vi.fn(),
            getAllCompletedSessions: vi.fn(),
            createSession: vi.fn(),
            completeSession: vi.fn(),
            deleteSession: vi.fn().mockRejectedValue(new Error('Storage failure')),
        };

        const useCase = new AbandonQuizSessionUseCase(mockRepo);
        await expect(useCase.execute('sess-active')).rejects.toThrow('Storage failure');
    });
});
