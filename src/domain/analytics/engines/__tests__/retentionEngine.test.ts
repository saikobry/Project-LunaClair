import { describe, it, expect } from 'vitest';
import { computeCardMaturity, computeReviewForecast } from '../retentionEngine';
import type { ReviewState } from '../../../flashcards/engines/scheduler';

describe('retentionEngine', () => {
    describe('computeCardMaturity()', () => {
        it('assigns cards to mutually exclusive buckets and enforces partition invariant', () => {
            const reviews: ReviewState[] = [
                // 1. New (reviewCount === 0)
                {
                    key: 'card-new-1',
                    repetitions: 0,
                    easeFactor: 2.5,
                    intervalDays: 0,
                    dueAt: '2026-08-25T00:00:00Z',
                    lapses: 0,
                    reviewCount: 0,
                },
                // 2. Learning (reviewCount > 0 && intervalDays < 7)
                {
                    key: 'card-learning-1',
                    repetitions: 1,
                    easeFactor: 2.5,
                    intervalDays: 1,
                    dueAt: '2026-08-26T00:00:00Z',
                    lapses: 0,
                    reviewCount: 1,
                },
                {
                    key: 'card-learning-2',
                    repetitions: 2,
                    easeFactor: 2.5,
                    intervalDays: 6,
                    dueAt: '2026-08-31T00:00:00Z',
                    lapses: 0,
                    reviewCount: 2,
                },
                // 3. Review (intervalDays >= 7 && intervalDays < 21)
                {
                    key: 'card-review-1',
                    repetitions: 3,
                    easeFactor: 2.5,
                    intervalDays: 14,
                    dueAt: '2026-09-08T00:00:00Z',
                    lapses: 0,
                    reviewCount: 3,
                },
                // 3b. Review (intervalDays >= 21 but lapses > 1)
                {
                    key: 'card-review-lapse',
                    repetitions: 4,
                    easeFactor: 2.1,
                    intervalDays: 30,
                    dueAt: '2026-09-24T00:00:00Z',
                    lapses: 2,
                    reviewCount: 5,
                },
                // 4. Mastered (intervalDays >= 21 && lapses <= 1)
                {
                    key: 'card-mastered-1',
                    repetitions: 5,
                    easeFactor: 2.6,
                    intervalDays: 21,
                    dueAt: '2026-09-15T00:00:00Z',
                    lapses: 0,
                    reviewCount: 5,
                },
                {
                    key: 'card-mastered-2',
                    repetitions: 6,
                    easeFactor: 2.7,
                    intervalDays: 60,
                    dueAt: '2026-10-24T00:00:00Z',
                    lapses: 1,
                    reviewCount: 6,
                },
            ];

            // 7 reviews recorded, plus 3 unreviewed cards -> totalCards = 10
            const maturity = computeCardMaturity(reviews, 10);

            expect(maturity.newCount).toBe(4); // 1 recorded with reviewCount 0 + 3 unrecorded
            expect(maturity.learningCount).toBe(2);
            expect(maturity.reviewCount).toBe(2);
            expect(maturity.masteredCount).toBe(2);
            expect(maturity.totalCards).toBe(10);

            // Invariant check: sum of all buckets === totalCards
            expect(maturity.newCount + maturity.learningCount + maturity.reviewCount + maturity.masteredCount).toBe(maturity.totalCards);
        });

        it('deduplicates reviews by key defensively', () => {
            const review: ReviewState = {
                key: 'duplicate-key',
                repetitions: 5,
                easeFactor: 2.5,
                intervalDays: 30,
                dueAt: '2026-09-25T00:00:00Z',
                lapses: 0,
                reviewCount: 5,
            };

            const maturity = computeCardMaturity([review, review], 1);
            expect(maturity.masteredCount).toBe(1);
            expect(maturity.totalCards).toBe(1);
        });

        it('does not mutate input array', () => {
            const reviews = Object.freeze([]) as readonly ReviewState[];
            expect(() => computeCardMaturity(reviews, 0)).not.toThrow();
        });
    });

    describe('computeReviewForecast()', () => {
        const refDate = new Date('2026-08-25T12:00:00.000Z');
        const timeZone = 'UTC';

        it('collapses overdue reviews into day 0 (today) and groups future reviews by local due date', () => {
            const reviews: ReviewState[] = [
                // Overdue (due before or at referenceDate) -> Day 0 (2026-08-25)
                {
                    key: 'card-overdue',
                    repetitions: 2,
                    easeFactor: 2.5,
                    intervalDays: 6,
                    dueAt: '2026-08-20T00:00:00.000Z',
                    lapses: 0,
                    reviewCount: 2,
                },
                // Due today -> Day 0 (2026-08-25)
                {
                    key: 'card-today',
                    repetitions: 1,
                    easeFactor: 2.5,
                    intervalDays: 1,
                    dueAt: '2026-08-25T10:00:00.000Z',
                    lapses: 0,
                    reviewCount: 1,
                },
                // Due tomorrow -> Day 1 (2026-08-26)
                {
                    key: 'card-tomorrow',
                    repetitions: 3,
                    easeFactor: 2.5,
                    intervalDays: 2,
                    dueAt: '2026-08-26T00:00:00.000Z',
                    lapses: 0,
                    reviewCount: 3,
                },
                // Due in 3 days -> Day 3 (2026-08-28)
                {
                    key: 'card-day-3',
                    repetitions: 4,
                    easeFactor: 2.5,
                    intervalDays: 5,
                    dueAt: '2026-08-28T00:00:00.000Z',
                    lapses: 0,
                    reviewCount: 4,
                },
            ];

            const forecast = computeReviewForecast(reviews, 7, refDate, timeZone);
            expect(forecast).toHaveLength(7);

            // Day 0: 2 cards (overdue + due today)
            expect(forecast[0].date).toBe('2026-08-25');
            expect(forecast[0].dueCount).toBe(2);
            expect(forecast[0].cumulativeDue).toBe(2);

            // Day 1: 1 card
            expect(forecast[1].date).toBe('2026-08-26');
            expect(forecast[1].dueCount).toBe(1);
            expect(forecast[1].cumulativeDue).toBe(3);

            // Day 2: 0 cards
            expect(forecast[2].date).toBe('2026-08-27');
            expect(forecast[2].dueCount).toBe(0);
            expect(forecast[2].cumulativeDue).toBe(3);

            // Day 3: 1 card
            expect(forecast[3].date).toBe('2026-08-28');
            expect(forecast[3].dueCount).toBe(1);
            expect(forecast[3].cumulativeDue).toBe(4);
        });

        it('returns empty array if daysAhead <= 0', () => {
            expect(computeReviewForecast([], 0)).toEqual([]);
        });
    });
});
