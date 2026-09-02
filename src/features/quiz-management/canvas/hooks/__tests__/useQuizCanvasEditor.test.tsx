import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuizCanvasEditor } from '../useQuizCanvasEditor';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import type { QuizDraft } from '../../../../../application/quiz-management/drafts/QuizDraft';
import type { Quiz } from '../../../../../domain/quiz/models/Quiz';
import type { Question } from '../../../../../domain/quiz/models/Question';

const mockShowToast = vi.fn();
vi.mock('../../../../../app/providers/ToastContext', () => ({
    useToast: () => ({ showToast: mockShowToast }),
    ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('useQuizCanvasEditor', () => {
    let queryClient: QueryClient;
    let mockContext: any;
    let mockOnClose: any;

    const mockQuestion1: Question = {
        id: 'q-1',
        materialId: 'mat-1',
        type: 'multiple_choice',
        prompt: 'Question 1 prompt',
        payload: { type: 'multiple_choice', choices: ['Option 1', 'Option 2'], correctIndex: 0 },
        difficulty: 'easy',
        points: 1,
        status: 'published',
        version: 1,
        createdAt: '2026-09-02T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
    };

    const mockQuiz: Quiz = {
        id: 'quiz-1',
        materialId: 'mat-1',
        title: 'Biology Test',
        description: 'Test description',
        status: 'draft',
        passingPercentage: 70,
        questionIds: ['q-1'],
        items: [
            {
                quizId: 'quiz-1',
                questionId: 'q-1',
                questionVersion: 1,
                order: 0,
                points: 2,
            },
        ],
        createdAt: '2026-09-02T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        mockOnClose = vi.fn();

        mockContext = {
            repositories: {
                question: {
                    getQuestions: vi.fn().mockResolvedValue([mockQuestion1]),
                    getQuestionsByIds: vi.fn().mockResolvedValue([mockQuestion1]),
                },
                quiz: {
                    getQuizById: vi.fn().mockResolvedValue(mockQuiz),
                },
                quizDraft: {
                    getDraftForQuiz: vi.fn().mockResolvedValue(null),
                    getDraftForMaterial: vi.fn().mockResolvedValue(null),
                    saveDraft: vi.fn().mockResolvedValue(undefined),
                    deleteDraft: vi.fn().mockResolvedValue(undefined),
                },
            },
            useCases: {
                quizManagement: {
                    saveQuiz: {
                        execute: vi.fn().mockResolvedValue({ success: true, quizId: 'quiz-1' }),
                    },
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

    it('initializes a fresh draft with 1 default question when no quizId is provided', async () => {
        const { result } = renderHook(
            () => useQuizCanvasEditor({ materialId: 'mat-1', onClose: mockOnClose }),
            { wrapper: createWrapper() },
        );

        expect(result.current.phase).toBe('loading');

        await waitFor(() => {
            expect(result.current.phase).toBe('ready');
        });

        expect(result.current.canvas.draft).not.toBeNull();
        expect(result.current.canvas.draft?.materialId).toBe('mat-1');
        expect(result.current.canvas.draft?.items).toHaveLength(1);
        expect(result.current.canvas.draft?.items[0].type).toBe('multiple_choice');
        expect(result.current.recovery).toBeNull();
    });

    it('seeds the canvas from an existing quiz when quizId is provided', async () => {
        const { result } = renderHook(
            () => useQuizCanvasEditor({ materialId: 'mat-1', quizId: 'quiz-1', onClose: mockOnClose }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.phase).toBe('ready');
        });

        expect(mockContext.repositories.quiz.getQuizById).toHaveBeenCalledWith('quiz-1');
        expect(mockContext.repositories.question.getQuestionsByIds).toHaveBeenCalledWith(['q-1']);

        const draft = result.current.canvas.draft;
        expect(draft?.quizId).toBe('quiz-1');
        expect(draft?.title).toBe('Biology Test');
        expect(draft?.passingPercentage).toBe(70);
        expect(draft?.items).toHaveLength(1);
        expect(draft?.items[0].questionId).toBe('q-1');
        expect(draft?.items[0].points).toBe(2);
    });

    it('detects a recoverable crash draft and allows restoring or discarding it', async () => {
        const recoverableDraft: QuizDraft = {
            draftId: 'recovered-draft-1',
            materialId: 'mat-1',
            title: 'Unsaved Crash Quiz',
            description: 'Recovered description',
            passingPercentage: 80,
            items: [
                {
                    tempId: 'recovered-item-1',
                    type: 'true_false',
                    prompt: 'Recovered prompt',
                    payload: { type: 'true_false', correctAnswer: true },
                    points: 1,
                    difficulty: 'medium',
                },
            ],
            isDirty: true,
            updatedAt: '2026-09-02T10:00:00.000Z',
        };

        mockContext.repositories.quizDraft.getDraftForMaterial.mockResolvedValue(recoverableDraft);

        const { result } = renderHook(
            () => useQuizCanvasEditor({ materialId: 'mat-1', onClose: mockOnClose }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.phase).toBe('ready');
        });

        expect(result.current.recovery).toEqual(recoverableDraft);

        // Test restoring
        act(() => {
            result.current.handleRestore();
        });

        expect(result.current.recovery).toBeNull();
        expect(result.current.canvas.draft?.title).toBe('Unsaved Crash Quiz');
        expect(mockShowToast).toHaveBeenCalledWith('Draft restored', { intent: 'info' });
    });

    it('discards recovery draft and deletes it from repository', async () => {
        const recoverableDraft: QuizDraft = {
            draftId: 'recovered-draft-2',
            materialId: 'mat-1',
            title: 'Discarded Draft',
            description: '',
            passingPercentage: 70,
            items: [],
            isDirty: true,
            updatedAt: '2026-09-02T10:00:00.000Z',
        };

        mockContext.repositories.quizDraft.getDraftForMaterial.mockResolvedValue(recoverableDraft);

        const { result } = renderHook(
            () => useQuizCanvasEditor({ materialId: 'mat-1', onClose: mockOnClose }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.recovery).toEqual(recoverableDraft);
        });

        await act(async () => {
            await result.current.handleDiscard();
        });

        expect(mockContext.repositories.quizDraft.deleteDraft).toHaveBeenCalledWith('recovered-draft-2');
        expect(result.current.recovery).toBeNull();
    });

    it('executes handleSave successfully, deletes draft, invalidates query, and shows toast', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(
            () => useQuizCanvasEditor({ materialId: 'mat-1', onClose: mockOnClose }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.phase).toBe('ready');
        });

        await act(async () => {
            await result.current.handleSave();
        });

        expect(mockContext.useCases.quizManagement.saveQuiz.execute).toHaveBeenCalled();
        expect(mockContext.repositories.quizDraft.deleteDraft).toHaveBeenCalled();
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assessment'] });
        expect(mockShowToast).toHaveBeenCalledWith('Quiz saved to catalog', { intent: 'success' });
        expect(result.current.saveState).toBe('saved');
    });

    it('handles validation failure on save by displaying errors without deleting draft', async () => {
        const validationErrors = {
            title: 'Quiz title is required',
            items: {},
        };

        mockContext.useCases.quizManagement.saveQuiz.execute.mockResolvedValue({
            success: false,
            errors: validationErrors,
        });

        const { result } = renderHook(
            () => useQuizCanvasEditor({ materialId: 'mat-1', onClose: mockOnClose }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.phase).toBe('ready');
        });

        await act(async () => {
            await result.current.handleSave();
        });

        expect(result.current.errors).toEqual(validationErrors);
        expect(mockContext.repositories.quizDraft.deleteDraft).not.toHaveBeenCalled();
        expect(result.current.saveState).toBe('idle');
    });

    it('handles unexpected throw during save and shows error toast', async () => {
        mockContext.useCases.quizManagement.saveQuiz.execute.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(
            () => useQuizCanvasEditor({ materialId: 'mat-1', onClose: mockOnClose }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.phase).toBe('ready');
        });

        await act(async () => {
            await result.current.handleSave();
        });

        expect(mockShowToast).toHaveBeenCalledWith('Save failed — your draft is preserved locally', { intent: 'error' });
        expect(result.current.saveState).toBe('idle');
    });

    it('manages bank import dialog state', async () => {
        const { result } = renderHook(
            () => useQuizCanvasEditor({ materialId: 'mat-1', onClose: mockOnClose }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.phase).toBe('ready');
        });

        expect(result.current.bankImport).toEqual({ open: false, anchor: null });

        act(() => {
            result.current.openBankImport(2);
        });
        expect(result.current.bankImport).toEqual({ open: true, anchor: 2 });

        act(() => {
            result.current.closeBankImport();
        });
        expect(result.current.bankImport).toEqual({ open: false, anchor: null });
    });

    it('triggers handleBack and calls onClose on Escape key press when bank import is closed', async () => {
        const { result } = renderHook(
            () => useQuizCanvasEditor({ materialId: 'mat-1', onClose: mockOnClose }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.phase).toBe('ready');
        });

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    it('does not trigger handleBack on Escape when bank import dialog is open', async () => {
        const { result } = renderHook(
            () => useQuizCanvasEditor({ materialId: 'mat-1', onClose: mockOnClose }),
            { wrapper: createWrapper() },
        );

        await waitFor(() => {
            expect(result.current.phase).toBe('ready');
        });

        act(() => {
            result.current.openBankImport(0);
        });

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });

        expect(mockOnClose).not.toHaveBeenCalled();
    });
});
