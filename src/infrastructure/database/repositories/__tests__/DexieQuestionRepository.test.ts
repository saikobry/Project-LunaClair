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

/**
 * The `sourceSection` write boundary. Provenance is normalized here exactly as tags are —
 * trim, and treat a blank as "not set" — so a whitespace-only label never persists as a
 * stored heading the user never saw.
 */
describe('DexieQuestionRepository — sourceSection write boundary', () => {
    const repo = new DexieQuestionRepository();
    const base = {
        type: 'fill_in_blank' as const,
        prompt: 'Most ATP is generated in the ___.',
        payload: { type: 'fill_in_blank' as const, template: 'Most ATP is generated in the ___.', blanks: ['mitochondria'] },
    };

    beforeEach(async () => {
        await db.questions.clear();
        await db.flashcardReviews.clear();
        await db.syncQueue.clear();
    });

    it('trims a supplied section label on create', async () => {
        const created = await repo.createQuestion({ materialId: 'mat-1', ...base, sourceSection: '  Cell Organelles  ' });

        expect(created.sourceSection).toBe('Cell Organelles');
        expect((await db.questions.get(created.id))?.sourceSection).toBe('Cell Organelles');
    });

    it('stores an absent or blank label as absent', async () => {
        const absent = await repo.createQuestion({ materialId: 'mat-1', ...base });
        const blank = await repo.createQuestion({ materialId: 'mat-1', ...base, sourceSection: '   ' });

        expect(absent.sourceSection).toBeUndefined();
        expect(blank.sourceSection).toBeUndefined();
    });

    it('normalizes each label in a batch independently', async () => {
        // Distinct prompts so each stored row is identifiable: `generateId()` is
        // time+random, so an index read back from Dexie is in key order, not input order.
        const labelled = { ...base, prompt: 'Labelled' };
        const absent = { ...base, prompt: 'Absent' };
        const blank = { ...base, prompt: 'Blank' };

        const created = await repo.createQuestionsBatch([
            { materialId: 'mat-1', ...labelled, sourceSection: 'Glycolysis' },
            { materialId: 'mat-1', ...absent },
            { materialId: 'mat-1', ...blank, sourceSection: '' },
        ]);

        const byPrompt = new Map(created.map((q) => [q.prompt, q.sourceSection]));
        expect(byPrompt.get('Labelled')).toBe('Glycolysis');
        expect(byPrompt.get('Absent')).toBeUndefined();
        expect(byPrompt.get('Blank')).toBeUndefined();

        // ...and the same three rows, read back out of storage.
        const stored = await db.questions.where('materialId').equals('mat-1').toArray();
        const storedByPrompt = new Map(stored.map((q) => [q.prompt, q.sourceSection]));
        expect(storedByPrompt.get('Labelled')).toBe('Glycolysis');
        expect(storedByPrompt.get('Absent')).toBeUndefined();
        expect(storedByPrompt.get('Blank')).toBeUndefined();
    });

    it('leaves the label alone on a partial update that does not mention it', async () => {
        const created = await repo.createQuestion({ materialId: 'mat-1', ...base, sourceSection: 'Glycolysis' });

        // The publish/archive/difficulty-only saves all take this path. If an absent field
        // cleared provenance, every publish would silently erase where a question came from.
        const published = await repo.updateQuestion(created.id, { status: 'published' });
        const reDifficulty = await repo.updateQuestion(created.id, { difficulty: 'hard' });

        expect(published.sourceSection).toBe('Glycolysis');
        expect(reDifficulty.sourceSection).toBe('Glycolysis');
    });

    /**
     * The clear half of the three-state update contract. `sourceSection` is CLEARABLE: a caller
     * that means "this question has no known origin" says so by passing a blank, and the label
     * goes — in the returned row AND in storage, so a later read does not resurrect it.
     *
     * The states are told apart on the RAW input, before normalization, because "absent" and
     * "present but blank" both normalize to `undefined`. Deciding inside the normalizer's
     * argument (`input.sourceSection ?? existing.sourceSection`, where a blank survives the
     * `??` and is normalized afterwards) reaches the same result by accident; asserting the
     * stored row as well is what stops an accidental reordering from silently turning a clear
     * into a preserve.
     */
    it('clears the label when the update explicitly blanks it, in the row and in storage', async () => {
        const created = await repo.createQuestion({ materialId: 'mat-1', ...base, sourceSection: 'Glycolysis' });

        const cleared = await repo.updateQuestion(created.id, { sourceSection: '   ' });

        expect(cleared.sourceSection).toBeUndefined();
        expect((await db.questions.get(created.id))?.sourceSection).toBeUndefined();
    });

    it('clears the label on an empty string exactly as it does on a whitespace-only one', async () => {
        // A caller clearing a text field sends `''`; a caller padding one sends `'   '`. They
        // are the same statement and must not be two different outcomes.
        const viaEmpty = await repo.createQuestion({ materialId: 'mat-1', ...base, prompt: 'A', sourceSection: 'Glycolysis' });
        const viaSpaces = await repo.createQuestion({ materialId: 'mat-1', ...base, prompt: 'B', sourceSection: 'Glycolysis' });

        expect((await repo.updateQuestion(viaEmpty.id, { sourceSection: '' })).sourceSection).toBeUndefined();
        expect((await repo.updateQuestion(viaSpaces.id, { sourceSection: '   ' })).sourceSection).toBeUndefined();
    });

    it('replaces the label when the update supplies a new one', async () => {
        // The third state, so "clearable" cannot be read as "writable" or "immutable" — the
        // boundary is three-state, not two.
        const created = await repo.createQuestion({ materialId: 'mat-1', ...base, sourceSection: 'Glycolysis' });

        const relabelled = await repo.updateQuestion(created.id, { sourceSection: '  Citric Acid Cycle  ' });

        expect(relabelled.sourceSection).toBe('Citric Acid Cycle');
        expect((await db.questions.get(created.id))?.sourceSection).toBe('Citric Acid Cycle');
    });

    it('does not resurrect a cleared label on a later unrelated save', async () => {
        // Once cleared, the question has no provenance — an absent field on a subsequent save
        // preserves "absent", so it cannot bring the old label back from a stale read.
        const created = await repo.createQuestion({ materialId: 'mat-1', ...base, sourceSection: 'Glycolysis' });
        await repo.updateQuestion(created.id, { sourceSection: '   ' });

        const published = await repo.updateQuestion(created.id, { status: 'published' });

        expect(published.sourceSection).toBeUndefined();
        expect((await db.questions.get(created.id))?.sourceSection).toBeUndefined();
    });

    it('treats an explicitly undefined field as absent, not as a clear', async () => {
        // `sourceSection: undefined` is what an object literal built by spreading a partial form
        // model carries. Reading it as a clear would let an unrelated save erase provenance.
        const created = await repo.createQuestion({ materialId: 'mat-1', ...base, sourceSection: 'Glycolysis' });

        const updated = await repo.updateQuestion(created.id, { sourceSection: undefined, points: 3 });

        expect(updated.sourceSection).toBe('Glycolysis');
    });
});
