import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuestionManagement } from '../useQuestionManagement';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { CreateQuestionInput, UpdateQuestionInput } from '../../../../domain/quiz/repositories/QuestionRepository';

describe('useQuestionManagement', () => {
    let queryClient: QueryClient;
    let mockContext: any;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });

        mockContext = {
            useCases: {
                quizManagement: {
                    createQuestion: { execute: vi.fn().mockResolvedValue({ id: 'q-new' }) },
                    updateQuestion: { execute: vi.fn().mockResolvedValue({ id: 'q-upd' }) },
                    publishQuestion: { execute: vi.fn().mockResolvedValue(undefined) },
                    archiveQuestion: { execute: vi.fn().mockResolvedValue(undefined) },
                    unarchiveQuestion: { execute: vi.fn().mockResolvedValue(undefined) },
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
            renderHook(() => useQuestionManagement());
        }).toThrow('useQuestionManagement must be used within a <ApplicationProvider>');
    });

    it('executes createQuestion mutation and invalidates assessment queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuestionManagement(), { wrapper: createWrapper() });

        const input: CreateQuestionInput = {
            materialId: 'mat-1',
            type: 'multiple_choice',
            prompt: 'Test prompt',
            payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
            difficulty: 'easy',
            points: 1,
            status: 'draft',
        };

        await act(async () => {
            await result.current.createQuestion.mutateAsync(input);
        });

        expect(mockContext.useCases.quizManagement.createQuestion.execute).toHaveBeenCalledWith(input);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
    });

    it('executes updateQuestion mutation and invalidates assessment queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuestionManagement(), { wrapper: createWrapper() });

        const input: UpdateQuestionInput = {
            prompt: 'Updated prompt',
            points: 3,
        };

        await act(async () => {
            await result.current.updateQuestion.mutateAsync({ id: 'q-1', input });
        });

        expect(mockContext.useCases.quizManagement.updateQuestion.execute).toHaveBeenCalledWith('q-1', input);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
    });

    it('executes publishQuestion mutation and invalidates assessment queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuestionManagement(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.publishQuestion.mutateAsync('q-1');
        });

        expect(mockContext.useCases.quizManagement.publishQuestion.execute).toHaveBeenCalledWith('q-1');
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
    });

    it('executes archiveQuestion mutation and invalidates assessment queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuestionManagement(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.archiveQuestion.mutateAsync('q-1');
        });

        expect(mockContext.useCases.quizManagement.archiveQuestion.execute).toHaveBeenCalledWith('q-1');
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
    });

    it('executes unarchiveQuestion mutation and invalidates assessment queries', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useQuestionManagement(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.unarchiveQuestion.mutateAsync('q-1');
        });

        expect(mockContext.useCases.quizManagement.unarchiveQuestion.execute).toHaveBeenCalledWith('q-1');
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
    });
});
