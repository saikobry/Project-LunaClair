import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuizSessionFlow } from '../useQuizSessionFlow';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import type { Quiz } from '../../../../../domain/quiz/models/Quiz';
import type { Question } from '../../../../../domain/quiz/models/Question';
import type { QuizSession } from '../../../../../domain/quiz/models/QuizSession';
import type { SubmitQuizSessionOutput } from '../../../../../application/use-cases/quiz/SubmitQuizSessionUseCase';

describe('useQuizSessionFlow', () => {
    let queryClient: QueryClient;
    let mockQuizRepo: any;
    let mockQuestionRepo: any;
    let mockStartSession: { execute: ReturnType<typeof vi.fn> };
    let mockSubmitSession: { execute: ReturnType<typeof vi.fn> };
    let mockAbandonSession: { execute: ReturnType<typeof vi.fn> };
    let mockContext: any;

    const mockQuiz: Quiz = {
        id: 'quiz-1',
        materialId: 'mat-1',
        title: 'Photosynthesis Quiz',
        status: 'published',
        questionIds: ['q-1', 'q-2'],
        items: [],
        createdAt: '2026-09-02T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
    };

    const mockQuestions: Question[] = [
        {
            id: 'q-1',
            materialId: 'mat-1',
            type: 'multiple_choice',
            difficulty: 'easy',
            status: 'published',
            version: 1,
            points: 1,
            prompt: 'Where does light reaction occur?',
            payload: { type: 'multiple_choice', choices: ['Thylakoid', 'Stroma'], correctIndex: 0 },
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
        {
            id: 'q-2',
            materialId: 'mat-1',
            type: 'true_false',
            difficulty: 'medium',
            status: 'published',
            version: 1,
            points: 1,
            prompt: 'Oxygen is a byproduct of photosynthesis.',
            payload: { type: 'true_false', correctAnswer: true },
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
    ];

    const mockSession: QuizSession = {
        id: 'session-phot-1',
        quizId: 'quiz-1',
        mode: 'practice',
        status: 'in_progress',
        startedAt: '2026-09-02T10:00:00.000Z',
        questionSnapshots: {},
        answers: [],
    };

    const mockSubmitOutput: SubmitQuizSessionOutput = {
        session: {
            ...mockSession,
            status: 'completed',
            completedAt: '2026-09-02T10:10:00.000Z',
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

        mockQuizRepo = {
            getQuizzesByIds: vi.fn().mockResolvedValue([mockQuiz]),
            getQuizzes: vi.fn().mockResolvedValue([mockQuiz]),
        };

        mockQuestionRepo = {
            getQuestionsByIds: vi.fn().mockResolvedValue(mockQuestions),
        };

        mockStartSession = {
            execute: vi.fn().mockResolvedValue(mockSession),
        };

        mockSubmitSession = {
            execute: vi.fn().mockResolvedValue(mockSubmitOutput),
        };

        mockAbandonSession = {
            execute: vi.fn().mockResolvedValue(undefined),
        };

        mockContext = {
            repositories: {
                quiz: mockQuizRepo,
                question: mockQuestionRepo,
            },
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

    it('waits for explicit activation before creating a persisted session', async () => {
        const { result, rerender } = renderHook(
            ({ isSessionActive }: { isSessionActive: boolean }) =>
                useQuizSessionFlow(
                    { type: 'quiz', quizId: '', materialId: 'mat-1', source: 'library', mode: 'practice' },
                    isSessionActive,
                ),
            {
                initialProps: { isSessionActive: false },
                wrapper: createWrapper(),
            },
        );

        await waitFor(() => {
            expect(result.current.flowState).toBe('ready');
        });
        expect(mockStartSession.execute).not.toHaveBeenCalled();

        rerender({ isSessionActive: true });

        await waitFor(() => {
            expect(mockStartSession.execute).toHaveBeenCalledWith({
                source: 'stored',
                quizId: 'quiz-1',
                mode: 'practice',
            });
        });
    });

    it('orchestrates flowState lifecycle from loading to ready, and creates a session', async () => {
        const { result } = renderHook(
            () => useQuizSessionFlow({ type: 'quiz', quizId: 'quiz-1', source: 'library', mode: 'practice' }, true),
            { wrapper: createWrapper() },
        );

        // Initially loading
        expect(result.current.flowState).toBe('loading');

        // Transitions to ready when quiz and questions load
        await waitFor(() => {
            expect(result.current.flowState).toBe('ready');
        });

        expect(result.current.currentQuestion).toEqual(mockQuestions[0]);
        expect(result.current.totalQuestions).toBe(2);
        expect(result.current.answeredCount).toBe(0);
        expect(result.current.isLastQuestion).toBe(false);

        // Session creation should be triggered exactly once
        expect(mockStartSession.execute).toHaveBeenCalledTimes(1);
        expect(mockStartSession.execute).toHaveBeenCalledWith({
            source: 'stored',
            quizId: 'quiz-1',
            mode: 'practice',
        });
    });

    it('preserves answer state across forward and backward navigation', async () => {
        const { result } = renderHook(
            () => useQuizSessionFlow({ type: 'quiz', quizId: 'quiz-1', source: 'library', mode: 'practice' }, true),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.flowState).toBe('ready');
        });

        // Answer question 1
        act(() => {
            result.current.setAnswer('q-1', '0');
        });

        expect(result.current.answeredCount).toBe(1);
        expect(result.current.answers.get('q-1')).toBe('0');

        // Navigate to question 2
        act(() => {
            result.current.goNext();
        });

        expect(result.current.currentIndex).toBe(1);
        expect(result.current.isLastQuestion).toBe(true);

        // Answer question 2
        act(() => {
            result.current.setAnswer('q-2', true);
        });

        expect(result.current.answeredCount).toBe(2);

        // Navigate back to question 1 — answer is intact
        act(() => {
            result.current.goPrev();
        });

        expect(result.current.currentIndex).toBe(0);
        expect(result.current.answers.get('q-1')).toBe('0');
        expect(result.current.answers.get('q-2')).toBe(true);
    });

    it('submits completed answers and transitions flowState to completed with results', async () => {
        const { result } = renderHook(
            () => useQuizSessionFlow({ type: 'quiz', quizId: 'quiz-1', source: 'library', mode: 'exam' }, true),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.flowState).toBe('ready');
        });

        act(() => {
            result.current.setAnswer('q-1', '0');
            result.current.setAnswer('q-2', true);
        });

        await act(async () => {
            result.current.submit();
        });

        await waitFor(() => {
            expect(result.current.flowState).toBe('completed');
        });

        expect(mockSubmitSession.execute).toHaveBeenCalledWith({
            sessionId: 'session-phot-1',
            submissions: [
                { questionId: 'q-1', value: '0' },
                { questionId: 'q-2', value: true },
            ],
        });
        expect(result.current.result).toEqual(mockSubmitOutput.result);
    });

    it('retakes quiz and resets state back to ready with a fresh session', async () => {
        const { result } = renderHook(
            () => useQuizSessionFlow({ type: 'quiz', quizId: 'quiz-1', source: 'library', mode: 'practice' }, true),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.flowState).toBe('ready');
        });

        act(() => {
            result.current.setAnswer('q-1', '0');
        });

        await act(async () => {
            result.current.submit();
        });

        await waitFor(() => {
            expect(result.current.flowState).toBe('completed');
        });

        // Trigger retake
        act(() => {
            result.current.retake();
        });

        await waitFor(() => {
            expect(result.current.flowState).toBe('ready');
        });

        expect(result.current.currentIndex).toBe(0);
        expect(result.current.answeredCount).toBe(0);
        expect(result.current.result).toBeNull();
        expect(result.current.answers.size).toBe(0);

        // Session creation should be called again for the retake
        expect(mockStartSession.execute).toHaveBeenCalledTimes(2);
    });

    it('handles session creation error gracefully', async () => {
        mockStartSession.execute.mockRejectedValue(new Error('Failed to initialize session'));

        const { result } = renderHook(
            () => useQuizSessionFlow({ type: 'quiz', quizId: 'quiz-1', source: 'library', mode: 'practice' }, true),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.flowState).toBe('error');
        });

        expect(result.current.error?.message).toBe('Failed to initialize session');
    });
});
