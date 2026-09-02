import { describe, expect, it, vi } from 'vitest';
import { SubmitQuizSessionUseCase } from '../SubmitQuizSessionUseCase';
import type { QuizSession } from '../../../../domain/quiz/models/QuizSession';
import type { QuizSessionRepository } from '../../../../domain/quiz/repositories/QuizSessionRepository';
import type { Question } from '../../../../domain/quiz/models/Question';

describe('SubmitQuizSessionUseCase', () => {
    const multipleChoiceQ: Question = {
        id: 'q-mc',
        materialId: 'mat-1',
        type: 'multiple_choice',
        prompt: 'What is the capital of France?',
        payload: {
            type: 'multiple_choice',
            choices: ['Berlin', 'Madrid', 'Paris', 'Rome'],
            correctIndex: 2,
        },
        points: 10,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const trueFalseQ: Question = {
        id: 'q-tf',
        materialId: 'mat-1',
        type: 'true_false',
        prompt: 'Water boils at 100 degrees Celsius at 1 atm.',
        payload: {
            type: 'true_false',
            correctAnswer: true,
        },
        points: 5,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const identificationQ: Question = {
        id: 'q-id',
        materialId: 'mat-1',
        type: 'identification',
        prompt: 'Who proposed the theory of general relativity?',
        payload: {
            type: 'identification',
            correctAnswer: 'Albert Einstein',
            acceptedAlternatives: ['Einstein'],
        },
        points: 10,
        difficulty: 'medium',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const createMockRepo = (session: QuizSession | null): QuizSessionRepository => ({
        getSessionById: vi.fn().mockResolvedValue(session),
        getSessions: vi.fn(),
        getAllCompletedSessions: vi.fn(),
        createSession: vi.fn(),
        completeSession: vi.fn().mockImplementation((sessionId, answers, score) =>
            Promise.resolve({
                ...session!,
                id: sessionId,
                status: 'completed',
                answers,
                score,
                completedAt: '2026-09-01T10:30:00.000Z',
            }),
        ),
        deleteSession: vi.fn(),
    });

    it('grades session with all answers correct and calculates 100% score', async () => {
        const session: QuizSession = {
            id: 'sess-1',
            quizId: 'quiz-1',
            mode: 'exam',
            status: 'in_progress',
            questionSnapshots: {
                'q-mc': multipleChoiceQ,
                'q-tf': trueFalseQ,
            },
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
        };

        const mockRepo = createMockRepo(session);
        const useCase = new SubmitQuizSessionUseCase(mockRepo);

        const output = await useCase.execute({
            sessionId: 'sess-1',
            submissions: [
                { questionId: 'q-mc', value: '2' },
                { questionId: 'q-tf', value: true },
            ],
        });

        expect(output.result.score).toEqual({
            correctAnswers: 2,
            incorrectAnswers: 0,
            earnedPoints: 15,
            maxPoints: 15,
            percentage: 100,
        });
        expect(output.session.status).toBe('completed');
        expect(mockRepo.completeSession).toHaveBeenCalledWith(
            'sess-1',
            output.result.answers,
            output.result.score,
        );
    });

    it('grades session with none correct and calculates 0% score', async () => {
        const session: QuizSession = {
            id: 'sess-2',
            quizId: 'quiz-1',
            mode: 'exam',
            status: 'in_progress',
            questionSnapshots: {
                'q-mc': multipleChoiceQ,
                'q-tf': trueFalseQ,
            },
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
        };

        const mockRepo = createMockRepo(session);
        const useCase = new SubmitQuizSessionUseCase(mockRepo);

        const output = await useCase.execute({
            sessionId: 'sess-2',
            submissions: [
                { questionId: 'q-mc', value: '0' },
                { questionId: 'q-tf', value: false },
            ],
        });

        expect(output.result.score).toEqual({
            correctAnswers: 0,
            incorrectAnswers: 2,
            earnedPoints: 0,
            maxPoints: 15,
            percentage: 0,
        });
        expect(output.session.status).toBe('completed');
    });

    it('grades partial submissions across multiple question types including identification alternatives', async () => {
        const session: QuizSession = {
            id: 'sess-3',
            quizId: 'quiz-1',
            mode: 'exam',
            status: 'in_progress',
            questionSnapshots: {
                'q-mc': multipleChoiceQ,
                'q-tf': trueFalseQ,
                'q-id': identificationQ,
            },
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
        };

        const mockRepo = createMockRepo(session);
        const useCase = new SubmitQuizSessionUseCase(mockRepo);

        const output = await useCase.execute({
            sessionId: 'sess-3',
            submissions: [
                { questionId: 'q-mc', value: '2' }, // Correct (10 pts)
                { questionId: 'q-tf', value: false }, // Incorrect (0 pts)
                { questionId: 'q-id', value: 'Einstein' }, // Correct accepted alternative (10 pts)
            ],
        });

        expect(output.result.score).toEqual({
            correctAnswers: 2,
            incorrectAnswers: 1,
            earnedPoints: 20,
            maxPoints: 25,
            percentage: 80,
        });
    });

    it('handles unanswered questions according to domain contract', async () => {
        const session: QuizSession = {
            id: 'sess-4',
            quizId: 'quiz-1',
            mode: 'exam',
            status: 'in_progress',
            questionSnapshots: {
                'q-mc': multipleChoiceQ,
                'q-tf': trueFalseQ,
            },
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
        };

        const mockRepo = createMockRepo(session);
        const useCase = new SubmitQuizSessionUseCase(mockRepo);

        // Only submitting q-mc, omitting q-tf
        const output = await useCase.execute({
            sessionId: 'sess-4',
            submissions: [{ questionId: 'q-mc', value: '2' }],
        });

        expect(output.result.score.correctAnswers).toBe(1);
        expect(output.result.score.incorrectAnswers).toBe(1);
        expect(output.result.score.earnedPoints).toBe(10);
        expect(output.result.score.maxPoints).toBe(10);
    });

    it('handles empty quiz gracefully', async () => {
        const session: QuizSession = {
            id: 'sess-empty',
            quizId: 'quiz-empty',
            mode: 'practice',
            status: 'in_progress',
            questionSnapshots: {},
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
        };

        const mockRepo = createMockRepo(session);
        const useCase = new SubmitQuizSessionUseCase(mockRepo);

        const output = await useCase.execute({
            sessionId: 'sess-empty',
            submissions: [],
        });

        expect(output.result.score).toEqual({
            correctAnswers: 0,
            incorrectAnswers: 0,
            earnedPoints: 0,
            maxPoints: 0,
            percentage: 0,
        });
    });

    it('rejects submission for non-existent session', async () => {
        const mockRepo = createMockRepo(null);
        const useCase = new SubmitQuizSessionUseCase(mockRepo);

        await expect(
            useCase.execute({
                sessionId: 'non-existent',
                submissions: [],
            }),
        ).rejects.toThrow('QuizSession not found: non-existent');
    });

    it('rejects submission for already completed session', async () => {
        const session: QuizSession = {
            id: 'sess-completed',
            quizId: 'quiz-1',
            mode: 'exam',
            status: 'completed',
            questionSnapshots: { 'q-mc': multipleChoiceQ },
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
            completedAt: '2026-09-01T10:15:00.000Z',
        };

        const mockRepo = createMockRepo(session);
        const useCase = new SubmitQuizSessionUseCase(mockRepo);

        await expect(
            useCase.execute({
                sessionId: 'sess-completed',
                submissions: [{ questionId: 'q-mc', value: '2' }],
            }),
        ).rejects.toThrow('Quiz session is not in progress');
    });

    it('rejects submission for abandoned session', async () => {
        const session: QuizSession = {
            id: 'sess-abandoned',
            quizId: 'quiz-1',
            mode: 'exam',
            status: 'abandoned',
            questionSnapshots: { 'q-mc': multipleChoiceQ },
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
        };

        const mockRepo = createMockRepo(session);
        const useCase = new SubmitQuizSessionUseCase(mockRepo);

        await expect(
            useCase.execute({
                sessionId: 'sess-abandoned',
                submissions: [{ questionId: 'q-mc', value: '2' }],
            }),
        ).rejects.toThrow('Quiz session is not in progress');
    });

    it('propagates persistence errors if completeSession fails', async () => {
        const session: QuizSession = {
            id: 'sess-err',
            quizId: 'quiz-1',
            mode: 'exam',
            status: 'in_progress',
            questionSnapshots: { 'q-mc': multipleChoiceQ },
            answers: [],
            startedAt: '2026-09-01T10:00:00.000Z',
        };

        const mockRepo: QuizSessionRepository = {
            getSessionById: vi.fn().mockResolvedValue(session),
            getSessions: vi.fn(),
            getAllCompletedSessions: vi.fn(),
            createSession: vi.fn(),
            completeSession: vi.fn().mockRejectedValue(new Error('IndexedDB Transaction Inactive')),
            deleteSession: vi.fn(),
        };

        const useCase = new SubmitQuizSessionUseCase(mockRepo);

        await expect(
            useCase.execute({
                sessionId: 'sess-err',
                submissions: [{ questionId: 'q-mc', value: '2' }],
            }),
        ).rejects.toThrow('IndexedDB Transaction Inactive');
    });
});
