import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../schema/LunaClairDatabase';
import { DexieQuestionRepository } from '../DexieQuestionRepository';
import { DexieFlashcardReviewRepository } from '../DexieFlashcardReviewRepository';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { ReviewState } from '../../../../domain/flashcards/engines/scheduler';

describe('DexieQuestionRepository — question deletion cascade', () => {
    const reviews = new DexieFlashcardReviewRepository();
    const repo = new DexieQuestionRepository();

    const now = '2026-09-01T00:00:00.000Z';

    const base = {
        materialId: 'mat-1',
        points: 5,
        difficulty: 'medium' as const,
        version: 1,
        status: 'published' as const,
        createdAt: now,
        updatedAt: now,
    };

    const cloze: Question = {
        ...base,
        id: 'q-cloze',
        type: 'fill_in_blank',
        prompt: 'Fill in the blank:',
        payload: { type: 'fill_in_blank', template: 'The ___ contains the ___.', blanks: ['alpha', 'beta'] },
    };

    const multipleChoice: Question = {
        ...base,
        id: 'q-mc',
        type: 'multiple_choice',
        prompt: 'Which one?',
        payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
    };

    // A second material's question, to prove the cascade is scoped.
    const otherMaterial: Question = {
        ...base,
        id: 'q-other',
        materialId: 'mat-2',
        type: 'identification',
        prompt: 'Capital of Japan?',
        payload: { type: 'identification', correctAnswer: 'Tokyo' },
    };

    function state(key: string, materialId: string): ReviewState {
        return {
            key,
            materialId,
            repetitions: 2,
            easeFactor: 2.5,
            intervalDays: 6,
            dueAt: '2026-09-10T00:00:00.000Z',
            lapses: 0,
            lastReviewedAt: '2026-09-01T09:00:00.000Z',
            reviewCount: 2,
        };
    }

    beforeEach(async () => {
        await db.questions.clear();
        await db.flashcardReviews.clear();
        await db.syncQueue.clear();
        await db.questions.bulkPut([cloze, multipleChoice, otherMaterial]);
    });

    it('clears every per-blank key of a deleted cloze question and tombstones each one', async () => {
        await reviews.save([
            state('q:q-cloze#0', 'mat-1'),
            state('q:q-cloze#1', 'mat-1'),
            state('q:q-mc', 'mat-1'),
        ]);
        await db.syncQueue.clear();

        await repo.deleteQuestion('q-cloze');

        // The question row is gone...
        expect(await db.questions.get('q-cloze')).toBeUndefined();
        // ...and so are BOTH of its cards' schedules — 2 blanks, not 1 question.
        expect(await db.flashcardReviews.toArray()).toHaveLength(1);
        expect((await db.flashcardReviews.toArray()).map((r) => r.key)).toEqual(['q:q-mc']);

        // A local-only clear is not a clear: without a tombstone the next pull
        // restores the row and the schedule resurrects with stale SM-2 state.
        const tombstones = await db.syncQueue.toArray();
        expect(tombstones.map((item) => item.entityId).toSorted()).toEqual(['q:q-cloze#0', 'q:q-cloze#1']);
        expect(tombstones.every((item) => item.entityType === 'flashcardReview')).toBe(true);
        expect(tombstones.every((item) => item.operation === 'DELETE')).toBe(true);
        expect(tombstones.every((item) => item.status === 'pending')).toBe(true);
        expect(new Set(tombstones.map((item) => item.clientMutationId)).size).toBe(2);
    });

    it('clears the whole-question key of a 1:1 question', async () => {
        await reviews.save([state('q:q-mc', 'mat-1')]);
        await db.syncQueue.clear();

        await repo.deleteQuestion('q-mc');

        expect(await db.questions.get('q-mc')).toBeUndefined();
        expect(await db.flashcardReviews.toArray()).toEqual([]);
        expect((await db.syncQueue.toArray()).map((item) => item.entityId)).toEqual(['q:q-mc']);
    });

    it('clears keys left behind by an EARLIER card shape, not just the current projection', async () => {
        // The row is a 1:1 question now, but `#0..2` rows survive from when it
        // was a 3-blank cloze. Re-projecting the current row would only find
        // `q:q-mc` and leave the three per-blank schedules stranded.
        await reviews.save([
            state('q:q-mc', 'mat-1'),
            state('q:q-mc#0', 'mat-1'),
            state('q:q-mc#1', 'mat-1'),
            state('q:q-mc#2', 'mat-1'),
        ]);
        await db.syncQueue.clear();

        await repo.deleteQuestion('q-mc');

        expect(await db.flashcardReviews.toArray()).toEqual([]);
        expect((await db.syncQueue.toArray()).map((item) => item.entityId).toSorted()).toEqual([
            'q:q-mc',
            'q:q-mc#0',
            'q:q-mc#1',
            'q:q-mc#2',
        ]);
    });

    it("does not touch another question's schedules, even when its id extends the deleted one", async () => {
        // `q-other` does not extend `q-oth`, but `startsWith` on the bare
        // `q:<id>` would still be wrong in general (`q:q-1` vs `q:q-12`), so the
        // prefix scan is asserted against an id that genuinely shares a stem.
        await db.questions.put({ ...base, id: 'q-oth-2', type: 'true_false', prompt: 'P', payload: { type: 'true_false', correctAnswer: true } });
        await reviews.save([state('q:q-oth-2', 'mat-1'), state('q:q-oth-2#0', 'mat-1')]);
        await db.syncQueue.clear();

        await repo.deleteQuestion('q-oth');

        const survivors = (await db.flashcardReviews.toArray()).map((r) => r.key).toSorted();
        expect(survivors).toEqual(['q:q-oth-2', 'q:q-oth-2#0']);
        // Nothing was cleared, so nothing is tombstoned.
        expect(await db.syncQueue.toArray()).toEqual([]);
    });

    it('leaves other questions\' schedules untouched', async () => {
        await reviews.save([
            state('q:q-cloze#0', 'mat-1'),
            state('q:q-cloze#1', 'mat-1'),
            state('q:q-mc', 'mat-1'),
            state('q:q-other', 'mat-2'),
        ]);
        await db.syncQueue.clear();

        await repo.deleteQuestion('q-cloze');

        expect((await db.flashcardReviews.toArray()).map((r) => r.key).toSorted()).toEqual([
            'q:q-mc',
            'q:q-other',
        ]);
        expect((await db.syncQueue.toArray()).map((item) => item.entityId).toSorted()).toEqual([
            'q:q-cloze#0',
            'q:q-cloze#1',
        ]);
    });

    it('rolls the question delete back when the tombstone write fails', async () => {
        // Atomicity, not just co-location: a clear that cannot be synced must
        // not land, or the question would be gone locally while the remote
        // schedule stayed live and the next pull resurrected it.
        await reviews.save([state('q:q-cloze#0', 'mat-1')]);
        await db.syncQueue.clear();

        const outboxWrite = vi
            .spyOn(db.syncQueue, 'bulkPut')
            .mockRejectedValue(new Error('outbox unavailable'));
        await expect(repo.deleteQuestion('q-cloze')).rejects.toThrow('outbox unavailable');
        outboxWrite.mockRestore();

        expect(await db.questions.get('q-cloze')).toBeDefined();
        expect((await db.flashcardReviews.toArray()).map((r) => r.key)).toEqual(['q:q-cloze#0']);
        expect(await db.syncQueue.toArray()).toEqual([]);
    });

    it('is a no-op tombstone-wise for a question that never had a schedule', async () => {
        await db.syncQueue.clear();

        await repo.deleteQuestion('q-mc');

        expect(await db.questions.get('q-mc')).toBeUndefined();
        expect(await db.syncQueue.toArray()).toEqual([]);
    });
});
