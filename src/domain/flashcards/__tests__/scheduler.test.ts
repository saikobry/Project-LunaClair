import { describe, expect, it } from 'vitest';
import {
    createInitialReviewState,
    isDue,
    review,
    type ReviewState,
} from '../scheduler';

describe('scheduler (SuperMemo-2 SRS Algorithm)', () => {
    const fixedNow = new Date('2026-09-01T12:00:00.000Z');

    describe('createInitialReviewState', () => {
        it('initializes a clean state with default SM-2 constants', () => {
            const state = createInitialReviewState('q:123', fixedNow);

            expect(state.key).toBe('q:123');
            expect(state.repetitions).toBe(0);
            expect(state.easeFactor).toBe(2.5);
            expect(state.intervalDays).toBe(0);
            expect(state.lapses).toBe(0);
            expect(state.reviewCount).toBe(0);
            expect(state.dueAt).toBe(fixedNow.toISOString());
            expect(state.lastReviewedAt).toBeUndefined();
        });
    });

    describe('isDue', () => {
        it('returns true when state is undefined (new card)', () => {
            expect(isDue(undefined, fixedNow)).toBe(true);
        });

        it('returns true when dueAt <= now', () => {
            const pastState: ReviewState = {
                ...createInitialReviewState('q:1'),
                dueAt: new Date(fixedNow.getTime() - 1000).toISOString(),
            };
            expect(isDue(pastState, fixedNow)).toBe(true);

            const exactState: ReviewState = {
                ...createInitialReviewState('q:1'),
                dueAt: fixedNow.toISOString(),
            };
            expect(isDue(exactState, fixedNow)).toBe(true);
        });

        it('returns false when dueAt is strictly in the future', () => {
            const futureState: ReviewState = {
                ...createInitialReviewState('q:1'),
                dueAt: new Date(fixedNow.getTime() + 10000).toISOString(),
            };
            expect(isDue(futureState, fixedNow)).toBe(false);
        });
    });

    describe('review transition table & algorithm invariants', () => {
        it('resets repetitions, sets interval to 1 day, and increments lapses on rating "again"', () => {
            const existing: ReviewState = {
                key: 'q:1',
                repetitions: 4,
                easeFactor: 2.5,
                intervalDays: 20,
                dueAt: fixedNow.toISOString(),
                lapses: 1,
                reviewCount: 4,
                lastReviewedAt: '2026-08-10T12:00:00.000Z',
            };

            const next = review(existing, 'again', fixedNow);

            expect(next.repetitions).toBe(0);
            expect(next.intervalDays).toBe(1);
            expect(next.lapses).toBe(2);
            expect(next.reviewCount).toBe(5);
            expect(next.lastReviewedAt).toBe(fixedNow.toISOString());
            expect(next.dueAt).toBe(new Date(fixedNow.getTime() + 1 * 86400000).toISOString());
        });

        it('follows standard interval progression: rep 1 -> 1 day, rep 2 -> 6 days, rep 3 -> interval * EF on "good"', () => {
            // First review
            const initial = createInitialReviewState('q:1', fixedNow);
            const r1 = review(initial, 'good', fixedNow);
            expect(r1.repetitions).toBe(1);
            expect(r1.intervalDays).toBe(1);
            expect(r1.dueAt).toBe(new Date(fixedNow.getTime() + 1 * 86400000).toISOString());

            // Second review
            const r2 = review(r1, 'good', fixedNow);
            expect(r2.repetitions).toBe(2);
            expect(r2.intervalDays).toBe(6);
            expect(r2.dueAt).toBe(new Date(fixedNow.getTime() + 6 * 86400000).toISOString());

            // Third review: 6 * 2.5 = 15 days
            const r3 = review(r2, 'good', fixedNow);
            expect(r3.repetitions).toBe(3);
            expect(r3.intervalDays).toBe(15);
            expect(r3.dueAt).toBe(new Date(fixedNow.getTime() + 15 * 86400000).toISOString());
        });

        it('applies 1.3x bonus multiplier on "easy" when repetitions > 2', () => {
            const rep2State: ReviewState = {
                key: 'q:1',
                repetitions: 2,
                easeFactor: 2.6,
                intervalDays: 6,
                dueAt: fixedNow.toISOString(),
                lapses: 0,
                reviewCount: 2,
            };

            // rep 3 calculation: Math.round(6 * newEF) -> then multiplied by 1.3
            const next = review(rep2State, 'easy', fixedNow);

            expect(next.repetitions).toBe(3);
            expect(next.intervalDays).toBeGreaterThan(Math.round(6 * 2.6));
        });

        it('enforces Ease Factor minimum floor of 1.3', () => {
            let state = createInitialReviewState('q:1', fixedNow);

            // Repeated 'again' reviews decrease EF
            for (let i = 0; i < 15; i++) {
                state = review(state, 'again', fixedNow);
            }

            expect(state.easeFactor).toBe(1.3);
            expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
        });
    });
});
