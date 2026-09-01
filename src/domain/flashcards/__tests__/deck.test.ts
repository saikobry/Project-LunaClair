import { describe, expect, it } from 'vitest';
import { orderDeck } from '../deck';
import type { Question } from '../../quiz/Question';
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
});
