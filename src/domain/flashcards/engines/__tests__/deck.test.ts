import { describe, expect, it } from 'vitest';
import { orderDeck } from '../deck';
import { cardKeyForQuestion } from '../cardKey';
import { questionToCards } from '../questionToCards';
import type { Question } from '../../../quiz/models/Question';
import type { ReviewState } from '../scheduler';

describe('orderDeck', () => {
    const fixedNow = new Date('2026-09-01T12:00:00.000Z');

    const q1: Question = {
        id: 'q1',
        materialId: 'mat-1',
        type: 'true_false',
        prompt: 'Q1',
        payload: { type: 'true_false', correctAnswer: true },
        points: 1,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const q2: Question = {
        ...q1,
        id: 'q2',
        prompt: 'Q2',
    };

    const q3: Question = {
        ...q1,
        id: 'q3',
        prompt: 'Q3',
    };

    /** Two blanks, so it projects to two independently scheduled cards. */
    const q4: Question = {
        ...q1,
        id: 'q4',
        type: 'fill_in_blank',
        prompt: 'Fill in the blank:',
        payload: {
            type: 'fill_in_blank',
            template: 'The ___ contains the ___.',
            blanks: ['nucleus', 'chromatin'],
        },
    };

    /**
     * orderDeck is card-based, so the caller projects. Review fixtures are
     * keyed through the same helper the deck uses, so a drift in the key
     * scheme cannot make a reviewed card look new. The expected outputs below
     * stay literal to pin the `q:` format itself.
     */
    const cardsFor = (...questions: Question[]) => questions.flatMap(questionToCards);

    it('orders deck prioritizing overdue cards, then new cards, then future cards', () => {
        const reviews: Record<string, ReviewState> = {
            [cardKeyForQuestion('q1')]: {
                key: 'q:q1',
                repetitions: 3,
                easeFactor: 2.5,
                intervalDays: 10,
                dueAt: new Date(fixedNow.getTime() - 3600000).toISOString(), // 1 hr overdue
                lapses: 0,
                reviewCount: 3,
            },
            // q2 has no review state (New Card)
            [cardKeyForQuestion('q3')]: {
                key: 'q:q3',
                repetitions: 2,
                easeFactor: 2.5,
                intervalDays: 6,
                dueAt: new Date(fixedNow.getTime() + 86400000).toISOString(), // due in 1 day
                lapses: 0,
                reviewCount: 2,
            },
        };

        const ordered = orderDeck(cardsFor(q3, q1, q2), reviews, fixedNow, { studyMode: 'all' });

        expect(ordered.map((c) => c.key)).toEqual(['q:q1', 'q:q2', 'q:q3']);
    });

    it('filters out future non-due cards when studyMode is "due_only"', () => {
        const reviews: Record<string, ReviewState> = {
            [cardKeyForQuestion('q1')]: {
                key: 'q:q1',
                repetitions: 1,
                easeFactor: 2.5,
                intervalDays: 1,
                dueAt: fixedNow.toISOString(), // Due now
                lapses: 0,
                reviewCount: 1,
            },
            [cardKeyForQuestion('q3')]: {
                key: 'q:q3',
                repetitions: 2,
                easeFactor: 2.5,
                intervalDays: 6,
                dueAt: new Date(fixedNow.getTime() + 86400000).toISOString(), // Not due
                lapses: 0,
                reviewCount: 2,
            },
        };

        // q2 is new (isDue returns true for undefined)
        const ordered = orderDeck(cardsFor(q1, q2, q3), reviews, fixedNow, { studyMode: 'due_only' });

        expect(ordered.map((c) => c.key)).toEqual(['q:q1', 'q:q2']);
    });

    it('keeps the incoming (quiz-item) order for cards with no review history', () => {
        // FlashcardTab projects the selected quiz's questions — already
        // arranged by Quiz.items[].order — before calling orderDeck. With no
        // reviews every card lands in the `new` bucket, which preserves that
        // incoming order verbatim.
        const quizOrder: Question[] = [q3, q1, q2];

        const ordered = orderDeck(cardsFor(...quizOrder), {}, fixedNow, { studyMode: 'all' });

        expect(ordered.map((c) => c.key)).toEqual(['q:q3', 'q:q1', 'q:q2']);
    });

    it('supersedes the incoming (quiz-item) order with due-date order once cards are reviewed', () => {
        const reviews: Record<string, ReviewState> = {
            [cardKeyForQuestion('q1')]: {
                key: 'q:q1',
                repetitions: 2,
                easeFactor: 2.5,
                intervalDays: 3,
                dueAt: new Date(fixedNow.getTime() - 3600000).toISOString(), // 1 hr overdue
                lapses: 0,
                reviewCount: 2,
            },
            [cardKeyForQuestion('q3')]: {
                key: 'q:q3',
                repetitions: 4,
                easeFactor: 2.5,
                intervalDays: 8,
                dueAt: new Date(fixedNow.getTime() - 18000000).toISOString(), // 5 hr overdue
                lapses: 0,
                reviewCount: 4,
            },
            // q2 has no review state (New Card)
        };

        // The quiz asks for q1 first, but reviewed cards are re-bucketed and sorted
        // by dueAt, so the more overdue q3 leads and the untouched q2 trails.
        const quizOrder: Question[] = [q1, q3, q2];

        const ordered = orderDeck(cardsFor(...quizOrder), reviews, fixedNow, { studyMode: 'all' });

        expect(ordered.map((c) => c.key)).toEqual(['q:q3', 'q:q1', 'q:q2']);
    });

    it("keeps a question's per-blank cards contiguous and in blank order", () => {
        // The caller's projection order is the deck order: q4's two cloze cards
        // inherit q4's slot in the incoming list, adjacent to one another.
        const ordered = orderDeck(cardsFor(q3, q4, q1), {}, fixedNow, { studyMode: 'all' });

        expect(ordered.map((c) => c.key)).toEqual([
            'q:q3',
            'q:q4#0',
            'q:q4#1',
            'q:q1',
        ]);
    });

    it('schedules each blank of a question independently', () => {
        // Reviewing blank #0 must not make its sibling look reviewed: the two
        // keys are distinct, so a future-scheduled #0 drops out of `due_only`
        // while its still-new #1 remains.
        const reviews: Record<string, ReviewState> = {
            'q:q4#0': {
                key: 'q:q4#0',
                repetitions: 1,
                easeFactor: 2.5,
                intervalDays: 6,
                dueAt: new Date(fixedNow.getTime() + 86400000).toISOString(), // Not due
                lapses: 0,
                reviewCount: 1,
            },
        };

        const ordered = orderDeck(cardsFor(q4), reviews, fixedNow, { studyMode: 'due_only' });

        expect(ordered.map((c) => c.key)).toEqual(['q:q4#1']);
    });

    it('orders reviewed per-blank cards by their own due dates', () => {
        const reviews: Record<string, ReviewState> = {
            'q:q4#0': {
                key: 'q:q4#0',
                repetitions: 1,
                easeFactor: 2.5,
                intervalDays: 6,
                dueAt: new Date(fixedNow.getTime() + 86400000).toISOString(), // Not due
                lapses: 0,
                reviewCount: 1,
            },
            'q:q4#1': {
                key: 'q:q4#1',
                repetitions: 1,
                easeFactor: 2.5,
                intervalDays: 6,
                dueAt: new Date(fixedNow.getTime() - 3600000).toISOString(), // Overdue
                lapses: 0,
                reviewCount: 1,
            },
        };

        // Blank order is #0 then #1, but #1 is overdue so it leads the due bucket
        // and #0 trails in the not-due bucket.
        const ordered = orderDeck(cardsFor(q4), reviews, fixedNow, { studyMode: 'all' });

        expect(ordered.map((c) => c.key)).toEqual(['q:q4#1', 'q:q4#0']);
    });
});
