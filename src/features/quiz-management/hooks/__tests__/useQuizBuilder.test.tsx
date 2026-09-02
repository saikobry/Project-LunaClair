import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuizBuilder } from '../useQuizBuilder';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { CreateQuizInput, UpdateQuizInput } from '../../../../domain/quiz/repositories/QuizRepository';
import type { Question } from '../../../../domain/quiz/models/Question';

describe('useQuizBuilder', () => {
    let queryClient: QueryClient;
    let mockContext: any;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });

        mockContext = {
            useCases: {
                quizManagement: {
                    createQuiz: { execute: vi.fn().mockResolvedValue({ id: 'quiz-new' }) },
                    updateQuiz: { execute: vi.fn().mockResolvedValue({ id: 'quiz-upd' }) },
                    publishQuiz: { execute: vi.fn().mockResolvedValue(undefined) },
                    archiveQuiz: { execute: vi.fn().mockResolvedValue(undefined) },
                    unarchiveQuiz: { execute: vi.fn().mockResolvedValue(undefined) },
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

    it('throws error when used outside ApplicationContext', () => {
        expect(() => {
            renderHook(() => useQuizBuilder());
        }).toThrow('useQuizBuilder must be used within a <ApplicationProvider>');
    });

    it('executes createQuiz mutation and invalidates assessment queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuizBuilder(), { wrapper: createWrapper() });

        const input: CreateQuizInput = {
            materialId: 'mat-1',
            title: 'Sample Quiz',
            description: 'Sample description',
            passingPercentage: 75,
            questionIds: ['q-1'],
            status: 'draft',
        };

        const questions: Question[] = [
            {
                id: 'q-1',
                materialId: 'mat-1',
                type: 'multiple_choice',
                prompt: 'Prompt 1',
                payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
                difficulty: 'easy',
                points: 1,
                status: 'published',
                version: 1,
                createdAt: '2026-09-02T10:00:00.000Z',
                updatedAt: '2026-09-02T10:00:00.000Z',
            },
        ];

        await act(async () => {
            await result.current.createQuiz.mutateAsync({ input, questions });
        });

        expect(mockContext.useCases.quizManagement.createQuiz.execute).toHaveBeenCalledWith(input, questions);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
    });

    it('executes updateQuiz mutation and invalidates assessment queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuizBuilder(), { wrapper: createWrapper() });

        const input: UpdateQuizInput = {
            title: 'Updated Quiz Title',
            passingPercentage: 80,
        };

        await act(async () => {
            await result.current.updateQuiz.mutateAsync({ id: 'quiz-1', input });
        });

        expect(mockContext.useCases.quizManagement.updateQuiz.execute).toHaveBeenCalledWith('quiz-1', input);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
    });

    it('executes publishQuiz mutation and invalidates assessment queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuizBuilder(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.publishQuiz.mutateAsync('quiz-1');
        });

        expect(mockContext.useCases.quizManagement.publishQuiz.execute).toHaveBeenCalledWith('quiz-1');
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
    });

    it('executes archiveQuiz mutation and invalidates assessment queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuizBuilder(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.archiveQuiz.mutateAsync('quiz-1');
        });

        expect(mockContext.useCases.quizManagement.archiveQuiz.execute).toHaveBeenCalledWith('quiz-1');
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
    });

    it('executes unarchiveQuiz mutation and invalidates assessment queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuizBuilder(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.unarchiveQuiz.mutateAsync('quiz-1');
        });

        expect(mockContext.useCases.quizManagement.unarchiveQuiz.execute).toHaveBeenCalledWith('quiz-1');
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
    });
});
