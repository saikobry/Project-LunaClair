import { describe, it, expect } from 'vitest';
import { buildCardKeyPool } from '../cardKeyPool';
import { questionToCards } from '../../../flashcards/engines/questionToCards';
import type { Question } from '../../../quiz/models/Question';

describe('buildCardKeyPool', () => {
    const base = {
        materialId: 'mat-1',
        points: 5,
        difficulty: 'medium' as const,
        version: 1,
        status: 'published' as const,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const cloze = (id: string, blanks: string[], status: Question['status'] = 'published'): Question => ({
        ...base,
        id,
        status,
        type: 'fill_in_blank',
        prompt: 'Fill in the blank:',
        // The marker count must equal the blank count, or the projection
        // deliberately falls back to a single whole-question card.
        payload: {
            type: 'fill_in_blank',
            template: blanks.map(() => '___').join(' and '),
            blanks,
        },
    });

    const choice = (id: string, type: 'multiple_choice' | 'multiple_select'): Question => ({
        ...base,
        id,
        type,
        prompt: 'Pick one.',
        payload:
            type === 'multiple_choice'
                ? { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 }
                : { type: 'multiple_select', choices: ['A', 'B'], correctIndices: [0, 1] },
    });

    /**
     * The pool MUST be the projection, not a question count. If it ever stops
     * being `questionToCards`' output, every maturity bucket and the "N total
     * flashcards" label silently become a question count again — a wrong number
     * with no error anywhere. So the keys are asserted as literals and the
     * cardinality is compared against the projection itself.
     */
    it('contains one key per blank of a multi-blank question, exactly as questionToCards projects them', () => {
        const question = cloze('q-cloze', ['alpha', 'beta', 'gamma']);

        const pool = buildCardKeyPool([question]);

        expect([...pool].toSorted()).toEqual(['q:q-cloze#0', 'q:q-cloze#1', 'q:q-cloze#2']);
        expect(pool.size).toBe(3);
        // 3 blanks is 3 cards and NOT 1 question.
        expect(pool.size).not.toBe(1);
    });

    it('matches questionToCards key-for-key for a mixed pool', () => {
        const questions: Question[] = [
            choice('q-mc', 'multiple_choice'),
            choice('q-ms', 'multiple_select'),
            cloze('q-cloze', ['alpha', 'beta']),
            {
                ...base,
                id: 'q-tf',
                type: 'true_false',
                prompt: 'Water boils at 100C.',
                payload: { type: 'true_false', correctAnswer: true },
            },
        ];

        const projected = questions.flatMap(questionToCards).map((card) => card.key);
        const pool = buildCardKeyPool(questions);

        expect([...pool].toSorted()).toEqual(projected.toSorted());
        // 1 + 1 + 2 blanks + 1 = 5 cards from 4 questions.
        expect(pool.size).toBe(5);
        expect(questions).toHaveLength(4);
    });

    it('falls back to the whole-question key for a cloze row with no per-blank expansion', () => {
        // Marker/answer disagreement: the projection keeps the legacy single
        // card, so the pool must carry `q:<id>` and no `#n` keys.
        const legacy: Question = {
            ...base,
            id: 'q-legacy',
            type: 'fill_in_blank',
            prompt: 'Fill in the blank:',
            payload: { type: 'fill_in_blank', template: 'The ___ stores DNA.', blanks: ['nucleus', 'DNA'] },
        };

        const pool = buildCardKeyPool([legacy]);

        expect([...pool]).toEqual(['q:q-legacy']);
        expect(questionToCards(legacy).map((card) => card.key)).toEqual([...pool]);
    });

    it('counts multiple_choice and multiple_select cards — they are real cards in the deck', () => {
        // The player renders their options on the front face as a genuine study
        // interaction, so discounting them would understate the deck.
        const pool = buildCardKeyPool([choice('q-mc', 'multiple_choice'), choice('q-ms', 'multiple_select')]);

        expect([...pool].toSorted()).toEqual(['q:q-mc', 'q:q-ms']);
        expect(pool.size).toBe(2);
    });

    it('contributes no keys for an archived question', () => {
        const pool = buildCardKeyPool([
            cloze('q-live', ['alpha']),
            { ...cloze('q-archived', ['alpha', 'beta']), status: 'archived' },
        ]);

        expect([...pool]).toEqual(['q:q-live#0']);
        expect(pool.size).toBe(1);
    });

    it('includes draft questions — only `archived` is out of scope', () => {
        const pool = buildCardKeyPool([cloze('q-draft', ['alpha'], 'draft')]);

        expect([...pool]).toEqual(['q:q-draft#0']);
    });

    it('is a union, not a concatenation: one key per distinct card', () => {
        const pool = buildCardKeyPool([
            cloze('q-cloze', ['alpha', 'beta']),
            cloze('q-cloze', ['alpha', 'beta']),
            cloze('q-cloze', ['alpha', 'beta', 'gamma']),
        ]);

        expect([...pool].toSorted()).toEqual(['q:q-cloze#0', 'q:q-cloze#1', 'q:q-cloze#2']);
        expect(pool.size).toBe(3);
    });

    it('returns an empty set for no questions', () => {
        expect(buildCardKeyPool([]).size).toBe(0);
    });

    it('does not mutate the input array or the questions in it', () => {
        const questions = Object.freeze([cloze('q-cloze', ['alpha', 'beta'])]) as readonly Question[];

        const pool = buildCardKeyPool(questions);

        expect(questions).toHaveLength(1);
        expect(questions[0].payload).toEqual({
            type: 'fill_in_blank',
            template: '___ and ___',
            blanks: ['alpha', 'beta'],
        });
        expect(pool.size).toBe(2);
    });
});
