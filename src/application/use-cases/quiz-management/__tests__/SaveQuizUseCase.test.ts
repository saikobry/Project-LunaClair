import { describe, expect, it, vi } from 'vitest';
import { SaveQuizUseCase } from '../SaveQuizUseCase';
import type { QuestionRepository } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { QuizEditorService, SaveQuizToRepositoryInput } from '../../../../domain/quiz/services/QuizEditorService';
import type { QuizDraft } from '../../../quiz-management/drafts/QuizDraft';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';

describe('SaveQuizUseCase', () => {
    const sampleExistingQuestion: Question = {
        id: 'q-bank-1',
        materialId: 'mat-1',
        type: 'multiple_choice',
        prompt: 'What is the powerhouse of the cell?',
        payload: {
            type: 'multiple_choice',
            choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
            correctIndex: 1,
        },
        points: 5,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        explanation: 'Mitochondria produce ATP.',
        tags: ['biology'],
    };

    const createServices = (existingQuestions: Question[] = [sampleExistingQuestion]) => {
        const savedQuiz: Quiz = {
            id: 'quiz-saved-1',
            materialId: 'mat-1',
            title: 'Cell Biology Quiz',
            status: 'draft',
            questionIds: ['q-bank-1'],
            items: [{ quizId: 'quiz-saved-1', questionId: 'q-bank-1', questionVersion: 1, order: 1, points: 5 }],
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
        };

        const questionRepo: QuestionRepository = {
            getQuestions: vi.fn(),
            getQuestionById: vi.fn(),
            getQuestionsByIds: vi.fn().mockResolvedValue(existingQuestions),
            createQuestion: vi.fn(),
            createQuestionsBatch: vi.fn(),
            updateQuestion: vi.fn(),
            deleteQuestion: vi.fn(),
        };

        const editorService: QuizEditorService = {
            saveQuiz: vi.fn().mockResolvedValue({
                quiz: savedQuiz,
                updatedQuestionIds: ['q-bank-1'],
            }),
        };

        return { questionRepo, editorService, savedQuiz };
    };

    describe('Draft Validation Guard', () => {
        it('returns structured validation errors without touching repositories when draft is invalid', async () => {
            const { questionRepo, editorService } = createServices();
            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const invalidDraft: QuizDraft = {
                draftId: 'draft-1',
                materialId: 'mat-1',
                title: '', // Missing title
                passingPercentage: 70,
                items: [], // Empty items
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            const result = await useCase.execute(invalidDraft);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.title).toBeDefined();
            }
            expect(questionRepo.getQuestionsByIds).not.toHaveBeenCalled();
            expect(editorService.saveQuiz).not.toHaveBeenCalled();
        });
    });

    describe('Question Diff & Creation', () => {
        it('identifies new cards and marks them with kind: "create"', async () => {
            const { questionRepo, editorService } = createServices([]);
            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const draftWithNewQuestion: QuizDraft = {
                draftId: 'draft-new',
                materialId: 'mat-1',
                title: 'New Quiz',
                passingPercentage: 75,
                items: [
                    {
                        tempId: 'card-temp-1',
                        // questionId is undefined -> new question
                        type: 'true_false',
                        prompt: 'The sky is blue.',
                        payload: { type: 'true_false', correctAnswer: true },
                        points: 2,
                        difficulty: 'easy',
                        explanation: 'Atmospheric Rayleigh scattering.',
                        tags: ['physics'],
                    },
                ],
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            const result = await useCase.execute(draftWithNewQuestion);

            expect(result.success).toBe(true);
            expect(editorService.saveQuiz).toHaveBeenCalledWith(
                expect.objectContaining({
                    questionChanges: [
                        {
                            kind: 'create',
                            tempId: 'card-temp-1',
                            materialId: 'mat-1',
                            type: 'true_false',
                            prompt: 'The sky is blue.',
                            payload: { type: 'true_false', correctAnswer: true },
                            points: 2,
                            difficulty: 'easy',
                            explanation: 'Atmospheric Rayleigh scattering.',
                            tags: ['physics'],
                        },
                    ],
                }),
            );
        });
    });

    describe('Semantic Equality & Version Bump Determination', () => {
        it('does NOT bump version when only metadata/points/explanation change', async () => {
            const { questionRepo, editorService } = createServices([sampleExistingQuestion]);
            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const draft: QuizDraft = {
                draftId: 'draft-meta',
                materialId: 'mat-1',
                title: 'Cell Quiz',
                passingPercentage: 70,
                items: [
                    {
                        tempId: 'card-1',
                        questionId: 'q-bank-1',
                        type: 'multiple_choice',
                        prompt: sampleExistingQuestion.prompt, // Unchanged
                        payload: sampleExistingQuestion.payload, // Unchanged
                        points: 10, // Changed points on quiz
                        difficulty: 'hard', // Changed difficulty
                        explanation: 'New updated explanation text', // Changed explanation
                        tags: ['biology', 'advanced'], // Changed tags
                    },
                ],
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            await useCase.execute(draft);

            expect(editorService.saveQuiz).toHaveBeenCalledWith(
                expect.objectContaining({
                    questionChanges: [
                        expect.objectContaining({
                            kind: 'update',
                            questionId: 'q-bank-1',
                            bumpVersion: false,
                        }),
                    ],
                }),
            );
        });

        it('bumps version when prompt text is edited', async () => {
            const { questionRepo, editorService } = createServices([sampleExistingQuestion]);
            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const draft: QuizDraft = {
                draftId: 'draft-prompt',
                materialId: 'mat-1',
                title: 'Cell Quiz',
                passingPercentage: 70,
                items: [
                    {
                        tempId: 'card-1',
                        questionId: 'q-bank-1',
                        type: 'multiple_choice',
                        prompt: 'Which organelle is considered the powerhouse of the cell?', // Changed prompt
                        payload: sampleExistingQuestion.payload,
                        points: 5,
                        difficulty: 'easy',
                    },
                ],
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            await useCase.execute(draft);

            expect(editorService.saveQuiz).toHaveBeenCalledWith(
                expect.objectContaining({
                    questionChanges: [
                        expect.objectContaining({
                            kind: 'update',
                            questionId: 'q-bank-1',
                            bumpVersion: true,
                        }),
                    ],
                }),
            );
        });

        it('does NOT bump version for multiple_select when correctIndices are merely reordered', async () => {
            const msQuestion: Question = {
                id: 'q-ms',
                materialId: 'mat-1',
                type: 'multiple_select',
                prompt: 'Select prime numbers',
                payload: {
                    type: 'multiple_select',
                    choices: ['2', '3', '4', '5'],
                    correctIndices: [0, 1, 3],
                },
                points: 5,
                difficulty: 'easy',
                version: 1,
                status: 'published',
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
            };

            const { questionRepo, editorService } = createServices([msQuestion]);
            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const draft: QuizDraft = {
                draftId: 'draft-ms-reorder',
                materialId: 'mat-1',
                title: 'Math Quiz',
                passingPercentage: 70,
                items: [
                    {
                        tempId: 'card-ms',
                        questionId: 'q-ms',
                        type: 'multiple_select',
                        prompt: 'Select prime numbers',
                        payload: {
                            type: 'multiple_select',
                            choices: ['2', '3', '4', '5'],
                            correctIndices: [3, 0, 1], // Reordered array
                        },
                        points: 5,
                        difficulty: 'easy',
                    },
                ],
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            await useCase.execute(draft);

            expect(editorService.saveQuiz).toHaveBeenCalledWith(
                expect.objectContaining({
                    questionChanges: [
                        expect.objectContaining({
                            kind: 'update',
                            questionId: 'q-ms',
                            bumpVersion: false,
                        }),
                    ],
                }),
            );
        });

        it('bumps version for multiple_select when correctIndices set changes', async () => {
            const msQuestion: Question = {
                id: 'q-ms',
                materialId: 'mat-1',
                type: 'multiple_select',
                prompt: 'Select prime numbers',
                payload: {
                    type: 'multiple_select',
                    choices: ['2', '3', '4', '5'],
                    correctIndices: [0, 1, 3],
                },
                points: 5,
                difficulty: 'easy',
                version: 1,
                status: 'published',
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
            };

            const { questionRepo, editorService } = createServices([msQuestion]);
            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const draft: QuizDraft = {
                draftId: 'draft-ms-change',
                materialId: 'mat-1',
                title: 'Math Quiz',
                passingPercentage: 70,
                items: [
                    {
                        tempId: 'card-ms',
                        questionId: 'q-ms',
                        type: 'multiple_select',
                        prompt: 'Select prime numbers',
                        payload: {
                            type: 'multiple_select',
                            choices: ['2', '3', '4', '5'],
                            correctIndices: [0, 1], // Changed from [0, 1, 3]
                        },
                        points: 5,
                        difficulty: 'easy',
                    },
                ],
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            await useCase.execute(draft);

            expect(editorService.saveQuiz).toHaveBeenCalledWith(
                expect.objectContaining({
                    questionChanges: [
                        expect.objectContaining({
                            kind: 'update',
                            questionId: 'q-ms',
                            bumpVersion: true,
                        }),
                    ],
                }),
            );
        });

        it('bumps version for identification when acceptedAlternatives change', async () => {
            const idQuestion: Question = {
                id: 'q-id',
                materialId: 'mat-1',
                type: 'identification',
                prompt: 'Author of Hamlet',
                payload: {
                    type: 'identification',
                    correctAnswer: 'William Shakespeare',
                    acceptedAlternatives: ['Shakespeare'],
                },
                points: 5,
                difficulty: 'easy',
                version: 1,
                status: 'published',
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
            };

            const { questionRepo, editorService } = createServices([idQuestion]);
            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const draft: QuizDraft = {
                draftId: 'draft-id-alt',
                materialId: 'mat-1',
                title: 'Lit Quiz',
                passingPercentage: 70,
                items: [
                    {
                        tempId: 'card-id',
                        questionId: 'q-id',
                        type: 'identification',
                        prompt: 'Author of Hamlet',
                        payload: {
                            type: 'identification',
                            correctAnswer: 'William Shakespeare',
                            acceptedAlternatives: ['Shakespeare', 'The Bard'], // Added alternative
                        },
                        points: 5,
                        difficulty: 'easy',
                    },
                ],
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            await useCase.execute(draft);

            expect(editorService.saveQuiz).toHaveBeenCalledWith(
                expect.objectContaining({
                    questionChanges: [
                        expect.objectContaining({
                            kind: 'update',
                            questionId: 'q-id',
                            bumpVersion: true,
                        }),
                    ],
                }),
            );
        });

        it('bumps version for fill_in_blank when template or blanks change', async () => {
            const fibQuestion: Question = {
                id: 'q-fib',
                materialId: 'mat-1',
                type: 'fill_in_blank',
                prompt: 'Complete the equation',
                payload: {
                    type: 'fill_in_blank',
                    template: 'E = ___ * c^2',
                    blanks: ['m'],
                },
                points: 5,
                difficulty: 'easy',
                version: 1,
                status: 'published',
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
            };

            const { questionRepo, editorService } = createServices([fibQuestion]);
            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const draft: QuizDraft = {
                draftId: 'draft-fib',
                materialId: 'mat-1',
                title: 'Physics Quiz',
                passingPercentage: 70,
                items: [
                    {
                        tempId: 'card-fib',
                        questionId: 'q-fib',
                        type: 'fill_in_blank',
                        prompt: 'Complete the equation',
                        payload: {
                            type: 'fill_in_blank',
                            template: 'E = ___ * c^___',
                            blanks: ['m', '2'], // Changed template and blanks
                        },
                        points: 5,
                        difficulty: 'easy',
                    },
                ],
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            await useCase.execute(draft);

            expect(editorService.saveQuiz).toHaveBeenCalledWith(
                expect.objectContaining({
                    questionChanges: [
                        expect.objectContaining({
                            kind: 'update',
                            questionId: 'q-fib',
                            bumpVersion: true,
                        }),
                    ],
                }),
            );
        });
    });

    describe('Save Orchestration', () => {
        it('persists ordered quiz items and returns SaveQuizResult', async () => {
            const { questionRepo, editorService, savedQuiz } = createServices([sampleExistingQuestion]);
            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const draft: QuizDraft = {
                draftId: 'draft-orch',
                quizId: 'quiz-saved-1',
                materialId: 'mat-1',
                title: 'Cell Biology Quiz',
                description: 'Midterm practice',
                passingPercentage: 70,
                items: [
                    {
                        tempId: 'card-1',
                        questionId: 'q-bank-1',
                        type: 'multiple_choice',
                        prompt: sampleExistingQuestion.prompt,
                        payload: sampleExistingQuestion.payload,
                        points: 5,
                        difficulty: 'easy',
                    },
                ],
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            const result = await useCase.execute(draft);

            expect(result).toEqual({
                success: true,
                quizId: savedQuiz.id,
                updatedQuestionIds: ['q-bank-1'],
            });

            const call = vi.mocked(editorService.saveQuiz).mock.calls[0][0] as SaveQuizToRepositoryInput;
            expect(call.quiz.items[0]).toEqual({
                tempId: 'card-1',
                order: 1,
                points: 5,
            });
        });

        it('propagates errors when editorService.saveQuiz rejects', async () => {
            const { questionRepo, editorService } = createServices([sampleExistingQuestion]);
            vi.mocked(editorService.saveQuiz).mockRejectedValue(new Error('Transaction aborted'));

            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const draft: QuizDraft = {
                draftId: 'draft-err',
                materialId: 'mat-1',
                title: 'Cell Quiz',
                passingPercentage: 70,
                items: [
                    {
                        tempId: 'card-1',
                        questionId: 'q-bank-1',
                        type: 'multiple_choice',
                        prompt: sampleExistingQuestion.prompt,
                        payload: sampleExistingQuestion.payload,
                        points: 5,
                        difficulty: 'easy',
                    },
                ],
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            await expect(useCase.execute(draft)).rejects.toThrow('Transaction aborted');
        });
    });

    describe('Concurrency Guard', () => {
        it('deduplicates concurrent execute calls and shares the in-flight execution promise', async () => {
            const { questionRepo, editorService } = createServices([sampleExistingQuestion]);
            let resolveSave: ((val: any) => void) | null = null;
            const deferredPromise = new Promise((resolve) => {
                resolveSave = resolve;
            });
            vi.mocked(editorService.saveQuiz).mockReturnValue(deferredPromise as any);

            const useCase = new SaveQuizUseCase(questionRepo, editorService);

            const draft: QuizDraft = {
                draftId: 'draft-concurrent',
                materialId: 'mat-1',
                title: 'Cell Quiz',
                passingPercentage: 70,
                items: [
                    {
                        tempId: 'card-1',
                        questionId: 'q-bank-1',
                        type: 'multiple_choice',
                        prompt: sampleExistingQuestion.prompt,
                        payload: sampleExistingQuestion.payload,
                        points: 5,
                        difficulty: 'easy',
                    },
                ],
                updatedAt: '2026-09-01T00:00:00.000Z',
                isDirty: true,
            };

            const call1 = useCase.execute(draft);
            const call2 = useCase.execute(draft);

            // Both calls share the exact same promise reference
            expect(call1).toBe(call2);

            resolveSave!({
                quiz: { id: 'quiz-saved-1', materialId: 'mat-1', title: 'Cell Quiz', status: 'draft', items: [] },
                updatedQuestionIds: [],
            });

            const [res1, res2] = await Promise.all([call1, call2]);
            expect(res1).toEqual(res2);
            expect(editorService.saveQuiz).toHaveBeenCalledTimes(1);
        });
    });
});
