import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuizPersistence } from '../useQuizPersistence';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import type { QuizSession } from '../../../../../domain/quiz/models/QuizSession';
import type { SubmitQuizSessionOutput } from '../../../../../application/use-cases/quiz/SubmitQuizSessionUseCase';

describe('useQuizPersistence', () => {
    let queryClient: QueryClient;
    let mockStartSession: { execute: ReturnType<typeof vi.fn> };
    let mockSubmitSession: { execute: ReturnType<typeof vi.fn> };
    let mockAbandonSession: { execute: ReturnType<typeof vi.fn> };
    let mockContext: any;

    const mockSession: QuizSession = {
        id: 'session-123',
        quizId: 'quiz-1',
        mode: 'practice',
        status: 'in_progress',
        startedAt: '2026-09-02T10:00:00.000Z',
        questionSnapshots: {},
        answers: [],
    };

    const mockCompletedOutput: SubmitQuizSessionOutput = {
        session: {
            ...mockSession,
            status: 'completed',
            completedAt: '2026-09-02T10:15:00.000Z',
            score: {
                correctAnswers: 2,
                incorrectAnswers: 0,
                earnedPoints: 2,
                maxPoints: 2,
                percentage: 100,
            },
        },
        result: {
            answers: [],
            score: {
                correctAnswers: 2,
                incorrectAnswers: 0,
                earnedPoints: 2,
                maxPoints: 2,
                percentage: 100,
            },
        },
    };

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        mockStartSession = {
            execute: vi.fn().mockResolvedValue(mockSession),
        };
        mockSubmitSession = {
            execute: vi.fn().mockResolvedValue(mockCompletedOutput),
        };
        mockAbandonSession = {
            execute: vi.fn().mockResolvedValue(undefined),
        };

        mockContext = {
            useCases: {
                quiz: {
                    startSession: mockStartSession,
                    submitSession: mockSubmitSession,
                    abandonSession: mockAbandonSession,
                },
            },
        };
    });

    const createWrapper = () => ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ApplicationContext.Provider value={mockContext}>
                {children}
            </ApplicationContext.Provider>
        </QueryClientProvider>
    );

    it('creates a session and stores reference', async () => {
        const { result } = renderHook(() => useQuizPersistence(), { wrapper: createWrapper() });

        let created: QuizSession | undefined;
        await act(async () => {
            created = await result.current.createSession({ source: 'stored', quizId: 'quiz-1', mode: 'practice' });
        });

        expect(created).toEqual(mockSession);
        expect(mockStartSession.execute).toHaveBeenCalledWith({
            source: 'stored',
            quizId: 'quiz-1',
            mode: 'practice',
        });
        expect(result.current.sessionRef.current).toEqual(mockSession);
    });

    it('completes active session and invalidates analytics cache', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuizPersistence(), { wrapper: createWrapper() });

        // Start session first
        await act(async () => {
            await result.current.createSession({ source: 'stored', quizId: 'quiz-1', mode: 'practice' });
        });

        const submissions = [{ questionId: 'q-1', value: '0' }];
        let output: SubmitQuizSessionOutput | undefined;

        await act(async () => {
            output = await result.current.completeSession(submissions);
        });

        expect(mockSubmitSession.execute).toHaveBeenCalledWith({
            sessionId: 'session-123',
            submissions,
        });
        expect(output).toEqual(mockCompletedOutput);
        expect(result.current.sessionRef.current).toEqual(mockCompletedOutput.session);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['analytics'] });
    });

    it('throws error when completing without active session', async () => {
        const { result } = renderHook(() => useQuizPersistence(), { wrapper: createWrapper() });

        await expect(
            result.current.completeSession([{ questionId: 'q-1', value: '0' }]),
        ).rejects.toThrow('No active session to complete');
    });

    it('abandons active session and clears reference', async () => {
        const { result } = renderHook(() => useQuizPersistence(), { wrapper: createWrapper() });

        // Start session
        await act(async () => {
            await result.current.createSession({ source: 'stored', quizId: 'quiz-1', mode: 'practice' });
        });

        expect(result.current.sessionRef.current).not.toBeNull();

        await act(async () => {
            await result.current.abandonSession();
        });

        expect(mockAbandonSession.execute).toHaveBeenCalledWith('session-123');
        expect(result.current.sessionRef.current).toBeNull();
    });
});
