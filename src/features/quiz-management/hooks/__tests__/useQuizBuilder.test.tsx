import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuizBuilder } from '../useQuizBuilder';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';

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
