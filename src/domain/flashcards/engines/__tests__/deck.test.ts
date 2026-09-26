import { describe, expect, it } from 'vitest';
import { orderDeck } from '../deck';
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

    it('orders deck prioritizing overdue cards, then new cards, then future cards', () => {
        const reviews: Record<string, ReviewState> = {
            'q:q1': {
                key: 'q:q1',
                repetitions: 3,
                easeFactor: 2.5,
                intervalDays: 10,
                dueAt: new Date(fixedNow.getTime() - 3600000).toISOString(), // 1 hr overdue
                lapses: 0,
                reviewCount: 3,
            },
            // q2 has no review state (New Card)
            'q:q3': {
                key: 'q:q3',
                repetitions: 2,
                easeFactor: 2.5,
                intervalDays: 6,
                dueAt: new Date(fixedNow.getTime() + 86400000).toISOString(), // due in 1 day
                lapses: 0,
                reviewCount: 2,
            },
        };

        const ordered = orderDeck([q3, q1, q2], reviews, fixedNow, { studyMode: 'all' });

        expect(ordered.map((c) => c.key)).toEqual(['q:q1', 'q:q2', 'q:q3']);
    });

    it('filters out future non-due cards when studyMode is "due_only"', () => {
        const reviews: Record<string, ReviewState> = {
            'q:q1': {
                key: 'q:q1',
                repetitions: 1,
                easeFactor: 2.5,
                intervalDays: 1,
                dueAt: fixedNow.toISOString(), // Due now
                lapses: 0,
                reviewCount: 1,
            },
            'q:q3': {
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
        const ordered = orderDeck([q1, q2, q3], reviews, fixedNow, { studyMode: 'due_only' });

        expect(ordered.map((c) => c.key)).toEqual(['q:q1', 'q:q2']);
    });

    it('keeps the incoming (quiz-item) order for cards with no review history', () => {
        // FlashcardScreen hands orderDeck the selected quiz's questions already
        // arranged by Quiz.items[].order. With no reviews every card lands in the
        // `new` bucket, which preserves that incoming order verbatim.
        const quizOrder: Question[] = [q3, q1, q2];

        const ordered = orderDeck(quizOrder, {}, fixedNow, { studyMode: 'all' });

        expect(ordered.map((c) => c.key)).toEqual(['q:q3', 'q:q1', 'q:q2']);
    });

    it('supersedes the incoming (quiz-item) order with due-date order once cards are reviewed', () => {
        const reviews: Record<string, ReviewState> = {
            'q:q1': {
                key: 'q:q1',
                repetitions: 2,
                easeFactor: 2.5,
                intervalDays: 3,
                dueAt: new Date(fixedNow.getTime() - 3600000).toISOString(), // 1 hr overdue
                lapses: 0,
                reviewCount: 2,
            },
            'q:q3': {
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

        const ordered = orderDeck(quizOrder, reviews, fixedNow, { studyMode: 'all' });

        expect(ordered.map((c) => c.key)).toEqual(['q:q3', 'q:q1', 'q:q2']);
    });
});
