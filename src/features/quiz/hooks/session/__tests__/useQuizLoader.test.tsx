import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuizLoader } from '../useQuizLoader';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import type { Quiz } from '../../../../../domain/quiz/models/Quiz';
import type { Question } from '../../../../../domain/quiz/models/Question';

describe('useQuizLoader', () => {
    let queryClient: QueryClient;
    let mockQuizRepo: any;
    let mockQuestionRepo: any;
    let mockContext: any;

    const mockQuiz1: Quiz = {
        id: 'quiz-1',
        materialId: 'mat-1',
        title: 'Cell Biology Quiz',
        status: 'published',
        questionIds: ['q-1', 'q-2'],
        items: [],
        createdAt: '2026-09-02T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
    };

    const mockQuiz2: Quiz = {
        id: 'quiz-2',
        materialId: 'mat-1',
        title: 'Genetics Quiz',
        status: 'published',
        questionIds: ['q-2', 'q-3'],
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
            prompt: 'Question 1',
            payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
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
            points: 2,
            prompt: 'Question 2',
            payload: { type: 'true_false', correctAnswer: true },
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
        {
            id: 'q-3',
            materialId: 'mat-1',
            type: 'identification',
            difficulty: 'hard',
            status: 'published',
            version: 1,
            points: 3,
            prompt: 'Question 3',
            payload: { type: 'identification', correctAnswer: 'nucleus' },
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
    ];

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        mockQuizRepo = {
            getQuizzesByIds: vi.fn().mockResolvedValue([mockQuiz1]),
            getQuizzes: vi.fn().mockResolvedValue([mockQuiz1]),
        };

        mockQuestionRepo = {
            getQuestionsByIds: vi.fn().mockResolvedValue(mockQuestions.slice(0, 2)),
        };

        mockContext = {
            repositories: {
                quiz: mockQuizRepo,
                question: mockQuestionRepo,
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

    it('loads single quiz and its associated questions by quizId', async () => {
        const { result } = renderHook(
            () => useQuizLoader({ type: 'quiz', quizId: 'quiz-1', source: 'library', mode: 'practice' }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.quiz).toEqual(mockQuiz1);
        });

        expect(mockQuizRepo.getQuizzesByIds).toHaveBeenCalledWith(['quiz-1'], expect.anything());
        expect(mockQuestionRepo.getQuestionsByIds).toHaveBeenCalledWith(['q-1', 'q-2'], expect.anything());
        expect(result.current.questions).toHaveLength(2);
        expect(result.current.sourceQuizzes).toEqual([mockQuiz1]);
    });

    it('loads quizzes by materialId when materialId is provided', async () => {
        const { result } = renderHook(
            () => useQuizLoader({ type: 'quiz', materialId: 'mat-1', source: 'library', mode: 'exam' }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.quiz).toEqual(mockQuiz1);
        });

        expect(mockQuizRepo.getQuizzes).toHaveBeenCalledWith('mat-1', expect.anything());
    });

    it('synthesizes virtual quiz and deduplicates questions when type is quizzes', async () => {
        mockQuizRepo.getQuizzesByIds.mockResolvedValue([mockQuiz1, mockQuiz2]);
        mockQuestionRepo.getQuestionsByIds.mockResolvedValue(mockQuestions);

        const { result } = renderHook(
            () => useQuizLoader({ type: 'quizzes', quizIds: ['quiz-1', 'quiz-2'], source: 'library', mode: 'practice' }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.quiz).not.toBeNull();
        });

        expect(mockQuizRepo.getQuizzesByIds).toHaveBeenCalledWith(['quiz-1', 'quiz-2'], expect.anything());
        // Virtual quiz should contain deduplicated question IDs: q-1, q-2, q-3
        expect(result.current.quiz?.id).toContain('virtual:quizzes:');
        expect(result.current.sourceQuizzes).toEqual([mockQuiz1, mockQuiz2]);
    });

    it('handles error state when repository throws', async () => {
        mockQuizRepo.getQuizzesByIds.mockRejectedValue(new Error('Database unavailable'));

        const { result } = renderHook(
            () => useQuizLoader({ type: 'quiz', quizId: 'quiz-1', source: 'library', mode: 'practice' }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error?.message).toBe('Database unavailable');
        expect(result.current.quiz).toBeNull();
        expect(result.current.questions).toHaveLength(0);
    });
});
