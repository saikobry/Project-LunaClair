import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApplication } from '../createApplication';
import { ANALYTICS_QUERY_KEY } from '../analyticsInvalidation';
import { db } from '../../../infrastructure/database/schema/LunaClairDatabase';
import type { Question } from '../../../domain/quiz/models/Question';

/**
 * The `['analytics']` cache is invalidated at the **app composition boundary**,
 * not from a feature hook, precisely so that no `quiz-management -> analytics`
 * feature edge is needed. These tests drive the real composed graph: a cloze
 * write and a question deletion must each drop the analytics namespace.
 */
describe('composition-root analytics cache invalidation', () => {
    const now = '2026-09-01T00:00:00.000Z';

    const clozeQuestion: Question = {
        id: 'q-cloze',
        materialId: 'mat-1',
        type: 'fill_in_blank',
        difficulty: 'medium',
        points: 5,
        version: 1,
        status: 'published',
        prompt: 'Fill in the blank:',
        payload: { type: 'fill_in_blank', template: 'The ___ stores DNA.', blanks: ['nucleus'] },
        createdAt: now,
        updatedAt: now,
    };

    beforeEach(async () => {
        await db.questions.clear();
        await db.flashcardReviews.clear();
        await db.syncQueue.clear();
        await db.questions.put(clozeQuestion);
    });

    it('uses the same key namespace as useFlashcardRating / useQuizPersistence', () => {
        expect(ANALYTICS_QUERY_KEY).toEqual(['analytics']);
    });

    it('invalidates on a question write that changes a cloze answer', async () => {
        const invalidateAnalytics = vi.fn();
        const app = createApplication(invalidateAnalytics);

        await app.useCases.quizManagement.updateQuestion.execute('q-cloze', {
            payload: { type: 'fill_in_blank', template: 'The ___ stores RNA.', blanks: ['ribosome'] },
        });

        expect(invalidateAnalytics).toHaveBeenCalledTimes(1);
    });

    it('invalidates on a question deletion', async () => {
        const invalidateAnalytics = vi.fn();
        const app = createApplication(invalidateAnalytics);

        await app.repositories.question.deleteQuestion('q-cloze');

        expect(invalidateAnalytics).toHaveBeenCalledTimes(1);
        // The cascade ran through the same composed repository.
        expect(await db.questions.get('q-cloze')).toBeUndefined();
    });

    it('invalidates on question creation, including a batch', async () => {
        const invalidateAnalytics = vi.fn();
        const app = createApplication(invalidateAnalytics);

        await app.useCases.quizManagement.createQuestion.execute({
            materialId: 'mat-1',
            type: 'true_false',
            prompt: 'Water boils at 100C.',
            payload: { type: 'true_false', correctAnswer: true },
        });
        expect(invalidateAnalytics).toHaveBeenCalledTimes(1);

        await app.repositories.question.createQuestionsBatch([
            {
                materialId: 'mat-1',
                type: 'identification',
                prompt: 'Capital of Japan?',
                payload: { type: 'identification', correctAnswer: 'Tokyo' },
            },
        ]);
        expect(invalidateAnalytics).toHaveBeenCalledTimes(2);
    });

    it('invalidates on archive — an archived question leaves the pool', async () => {
        const invalidateAnalytics = vi.fn();
        const app = createApplication(invalidateAnalytics);

        await app.useCases.quizManagement.archiveQuestion.execute('q-cloze');

        expect(invalidateAnalytics).toHaveBeenCalledTimes(1);
        expect((await db.questions.get('q-cloze'))?.status).toBe('archived');
    });

    it('invalidates on a successful quiz canvas save, which writes through QuizEditorService', async () => {
        const invalidateAnalytics = vi.fn();
        const app = createApplication(invalidateAnalytics);

        const result = await app.useCases.quizManagement.saveQuiz.execute({
            draftId: 'draft-1',
            materialId: 'mat-1',
            title: 'Cloze practice',
            description: '',
            passingPercentage: 70,
            updatedAt: '2026-09-01T00:00:00.000Z',
            isDirty: true,
            items: [
                {
                    tempId: 'temp-1',
                    questionId: 'q-cloze',
                    type: 'fill_in_blank',
                    prompt: 'Fill in the blank:',
                    payload: { type: 'fill_in_blank', template: 'The ___ stores DNA.', blanks: ['nucleus'] },
                    difficulty: 'medium',
                    points: 5,
                },
            ],
        });

        expect(result.success).toBe(true);
        expect(invalidateAnalytics).toHaveBeenCalledTimes(1);
    });

    it('does not invalidate when a quiz canvas save fails validation — nothing was written', async () => {
        const invalidateAnalytics = vi.fn();
        const app = createApplication(invalidateAnalytics);

        // A blank title fails `validateQuizDraft`, so the pool is unchanged and
        // the author's errors must be the only consequence.
        const result = await app.useCases.quizManagement.saveQuiz.execute({
            draftId: 'draft-1',
            materialId: 'mat-1',
            title: '',
            description: '',
            passingPercentage: 70,
            updatedAt: '2026-09-01T00:00:00.000Z',
            isDirty: true,
            items: [],
        });

        expect(result.success).toBe(false);
        expect(invalidateAnalytics).not.toHaveBeenCalled();
    });

    it('never invalidates for a read', async () => {
        const invalidateAnalytics = vi.fn();
        const app = createApplication(invalidateAnalytics);

        await app.repositories.question.getQuestions('mat-1');
        await app.repositories.question.getQuestionById('q-cloze');
        await app.repositories.question.getQuestionsByIds(['q-cloze']);

        expect(invalidateAnalytics).not.toHaveBeenCalled();
    });

    it('does not invalidate when the wrapped write itself fails', async () => {
        const invalidateAnalytics = vi.fn();
        const app = createApplication(invalidateAnalytics);

        await expect(
            app.useCases.quizManagement.updateQuestion.execute('does-not-exist', { points: 9 }),
        ).rejects.toThrow();

        expect(invalidateAnalytics).not.toHaveBeenCalled();
    });

    it('defaults to a no-op invalidator so a graph assembled outside the shell still works', async () => {
        // `createApplication()` is called with no argument in any non-React
        // context; the decorator must not make that a crash.
        const app = createApplication();

        await expect(
            app.useCases.quizManagement.updateQuestion.execute('q-cloze', { points: 9 }),
        ).resolves.toBeDefined();
    });
});
