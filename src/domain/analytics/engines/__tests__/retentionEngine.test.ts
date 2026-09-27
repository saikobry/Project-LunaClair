import { describe, it, expect } from 'vitest';
import { computeCardMaturity, computeReviewForecast } from '../retentionEngine';
import { buildActivityCalendar } from '../activityEngine';
import type { ReviewState } from '../../../flashcards/engines/scheduler';

/** A reviewed card in a named bucket, keyed by the pool key it belongs to. */
function review(overrides: Partial<ReviewState> & { key: string }): ReviewState {
    return {
        repetitions: 1,
        easeFactor: 2.5,
        intervalDays: 1,
        dueAt: '2026-09-08T00:00:00.000Z',
        lapses: 0,
        reviewCount: 1,
        ...overrides,
    };
}

const NEW = review({ key: 'new', reviewCount: 0, intervalDays: 0 });
const LEARNING = review({ key: 'learning', intervalDays: 1, reviewCount: 1 });
const IN_REVIEW = review({ key: 'in-review', intervalDays: 14, reviewCount: 3 });
const LAPSED = review({ key: 'lapsed', intervalDays: 30, reviewCount: 5, lapses: 2 });
const MASTERED = review({ key: 'mastered', intervalDays: 21, reviewCount: 5 });

/** Fixed reference instant — every due comparison is anchored, never `now`. */
const refDate = new Date('2026-08-25T12:00:00.000Z');
const timeZone = 'UTC';

describe('retentionEngine', () => {
    describe('computeCardMaturity()', () => {
        /**
         * The pool is the input, not a count, so every case below is a table of
         * "these keys exist" → "these buckets". The partition invariant is
         * asserted against `cardKeys.size` — the pool the caller actually
         * derived — so a wrong pool fails here instead of being papered over.
         */
        const cases: Array<{
            label: string;
            cardKeys: string[];
            reviews: ReviewState[];
            expected: {
                newCount: number;
                learningCount: number;
                reviewCount: number;
                masteredCount: number;
                totalCards: number;
                orphanReviewCount: number;
            };
        }> = [
            {
                label: 'empty pool is an all-zero breakdown',
                cardKeys: [],
                reviews: [],
                expected: {
                    newCount: 0, learningCount: 0, reviewCount: 0, masteredCount: 0,
                    totalCards: 0, orphanReviewCount: 0,
                },
            },
            {
                label: 'an entirely unreviewed pool is entirely new',
                cardKeys: ['q:q-1', 'q:q-2#0', 'q:q-2#1', 'q:q-2#2'],
                reviews: [],
                expected: {
                    newCount: 4, learningCount: 0, reviewCount: 0, masteredCount: 0,
                    totalCards: 4, orphanReviewCount: 0,
                },
            },
            {
                label: 'a mixed reviewed/unreviewed pool fills every bucket once',
                cardKeys: ['new', 'learning', 'in-review', 'lapsed', 'mastered', 'q:q-9#0', 'q:q-9#1'],
                reviews: [NEW, LEARNING, IN_REVIEW, LAPSED, MASTERED],
                expected: {
                    // `new` is reviewed at reviewCount 0; the two unreviewed
                    // per-blank keys are new for a different reason.
                    newCount: 3, learningCount: 1, reviewCount: 2, masteredCount: 1,
                    totalCards: 7, orphanReviewCount: 0,
                },
            },
            {
                label: 'a review whose key is outside the pool is an orphan and inflates nothing',
                cardKeys: ['q:q-1', 'q:q-2#0'],
                reviews: [review({ key: 'q:q-2#0', intervalDays: 1, reviewCount: 1 }), MASTERED],
                expected: {
                    newCount: 1, learningCount: 1, reviewCount: 0, masteredCount: 0,
                    totalCards: 2, orphanReviewCount: 1,
                },
            },
            {
                label: 'several orphans are all reported and none is absorbed',
                cardKeys: ['q:q-1'],
                reviews: [review({ key: 'q:q-1', intervalDays: 1, reviewCount: 1 }), MASTERED, IN_REVIEW, LAPSED],
                expected: {
                    newCount: 0, learningCount: 1, reviewCount: 0, masteredCount: 0,
                    totalCards: 1, orphanReviewCount: 3,
                },
            },
            {
                label: 'a per-blank key of one cloze question is an independent card',
                // The pool is 1:1 with the blanks, so reviewing blank #1 leaves
                // #0 and #2 new — the per-blank schedule, not a per-question one.
                cardKeys: ['q:q-2#0', 'q:q-2#1', 'q:q-2#2'],
                reviews: [review({ key: 'q:q-2#1', intervalDays: 21, reviewCount: 4 })],
                expected: {
                    newCount: 2, learningCount: 0, reviewCount: 0, masteredCount: 1,
                    totalCards: 3, orphanReviewCount: 0,
                },
            },
            {
                label: 'a blank key that no longer projects is an orphan, not a new card',
                cardKeys: ['q:q-2#0', 'q:q-2#1'],
                reviews: [
                    review({ key: 'q:q-2#0', intervalDays: 21, reviewCount: 4 }),
                    review({ key: 'q:q-2#7', intervalDays: 21, reviewCount: 4 }),
                ],
                expected: {
                    newCount: 1, learningCount: 0, reviewCount: 0, masteredCount: 1,
                    totalCards: 2, orphanReviewCount: 1,
                },
            },
        ];

        for (const { label, cardKeys, reviews, expected } of cases) {
            it(label, () => {
                const maturity = computeCardMaturity(reviews, new Set(cardKeys));
                expect(maturity).toEqual(expected);
            });
        }

        it('sums the buckets to the pool size exactly, in every case', () => {
            // The partition invariant is the whole point of passing a set: it is
            // checkable against the pool the caller derived.
            const pools: Array<[string[], ReviewState[]]> = [
                [[], []],
                [['q:q-1'], []],
                [
                    ['q:q-1', 'q:q-1#0', 'q:q-1#1'],
                    [
                        review({ key: 'q:q-1', reviewCount: 0, intervalDays: 0 }),
                        review({ key: 'q:q-1#0', intervalDays: 1, reviewCount: 1 }),
                        review({ key: 'q:q-1#1', intervalDays: 14, reviewCount: 3 }),
                    ],
                ],
                // A pool of one with three orphan reviews: the exact shape the
                // deleted `Math.max` repair used to absorb.
                [
                    ['q:q-1'],
                    [
                        review({ key: 'q:q-1', intervalDays: 1, reviewCount: 1 }),
                        review({ key: 'q:gone#0', intervalDays: 30, reviewCount: 5 }),
                        review({ key: 'q:gone#1', intervalDays: 14, reviewCount: 3 }),
                        review({ key: 'q:gone-whole', intervalDays: 21, reviewCount: 4 }),
                    ],
                ],
                [
                    ['q:a#0', 'q:a#1', 'q:b', 'q:c', 'q:d#0', 'q:d#1', 'q:d#2'],
                    [
                        review({ key: 'q:a#0', intervalDays: 30, reviewCount: 5 }),
                        review({ key: 'q:a#1', intervalDays: 30, reviewCount: 5, lapses: 2 }),
                        review({ key: 'q:d#2', intervalDays: 2, reviewCount: 2 }),
                    ],
                ],
            ];

            for (const [keys, reviews] of pools) {
                const cardKeys = new Set(keys);
                const maturity = computeCardMaturity(reviews, cardKeys);
                const sum =
                    maturity.newCount +
                    maturity.learningCount +
                    maturity.reviewCount +
                    maturity.masteredCount;

                expect(sum).toBe(cardKeys.size);
                expect(maturity.totalCards).toBe(cardKeys.size);
            }
        });

        it('leaves totalCards and the buckets untouched when orphan reviews are added', () => {
            const cardKeys = new Set(['q:q-1', 'q:q-2#0', 'q:q-2#1']);
            const reviews = [
                review({ key: 'q:q-1', intervalDays: 1, reviewCount: 1 }),
                review({ key: 'q:q-2#0', intervalDays: 14, reviewCount: 3 }),
            ];

            const withoutOrphans = computeCardMaturity(reviews, cardKeys);
            const withOrphans = computeCardMaturity(
                [
                    ...reviews,
                    MASTERED,
                    LAPSED,
                    review({ key: 'q:deleted-question#0', intervalDays: 30, reviewCount: 3 }),
                ],
                cardKeys,
            );

            expect(withOrphans.orphanReviewCount).toBe(3);
            expect(withOrphans.totalCards).toBe(withoutOrphans.totalCards);
            expect(withOrphans.newCount).toBe(withoutOrphans.newCount);
            expect(withOrphans.learningCount).toBe(withoutOrphans.learningCount);
            expect(withOrphans.reviewCount).toBe(withoutOrphans.reviewCount);
            expect(withOrphans.masteredCount).toBe(withoutOrphans.masteredCount);
        });

        it('deduplicates reviews by key defensively', () => {
            const duplicate: ReviewState = review({ key: 'q:q-1', intervalDays: 30, reviewCount: 5 });
            const maturity = computeCardMaturity([duplicate, duplicate], new Set(['q:q-1']));

            expect(maturity.masteredCount).toBe(1);
            expect(maturity.totalCards).toBe(1);
            expect(maturity.orphanReviewCount).toBe(0);
        });

        it('reports an orphan once per key even when the row is duplicated', () => {
            const orphan: ReviewState = review({ key: 'q:gone' });
            const maturity = computeCardMaturity([orphan, orphan], new Set(['q:q-1']));

            expect(maturity.orphanReviewCount).toBe(1);
        });

        it('leaves the input array, the pool, and the review objects untouched', () => {
            const reviews = Object.freeze([Object.freeze(MASTERED)]) as readonly ReviewState[];
            const cardKeys = Object.freeze(new Set(['q:q-1', 'q:q-2#0'])) as ReadonlySet<string>;

            const maturity = computeCardMaturity(reviews, cardKeys);

            expect(reviews).toHaveLength(1);
            expect([...cardKeys]).toEqual(['q:q-1', 'q:q-2#0']);
            expect(maturity.totalCards).toBe(2);
        });

        it('never throws on orphaned rows — a diagnostic must not break the screen', () => {
            expect(() => computeCardMaturity([MASTERED, LAPSED], new Set())).not.toThrow();
        });
    });

    describe('computeReviewForecast()', () => {
        it('collapses overdue reviews into day 0 (today) and groups future reviews by local due date', () => {
            const reviews: ReviewState[] = [
                // Overdue (due before or at referenceDate) -> Day 0 (2026-08-25)
                review({ key: 'card-overdue', intervalDays: 6, dueAt: '2026-08-20T00:00:00.000Z', reviewCount: 2 }),
                // Due today -> Day 0 (2026-08-25)
                review({ key: 'card-today', dueAt: '2026-08-25T10:00:00.000Z' }),
                // Due tomorrow -> Day 1 (2026-08-26)
                review({ key: 'card-tomorrow', intervalDays: 2, dueAt: '2026-08-26T00:00:00.000Z', reviewCount: 3 }),
                // Due in 3 days -> Day 3 (2026-08-28)
                review({ key: 'card-day-3', intervalDays: 5, dueAt: '2026-08-28T00:00:00.000Z', reviewCount: 4 }),
            ];

            const forecast = computeReviewForecast(reviews, new Set(reviews.map((r) => r.key)), 7, refDate, timeZone);
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

        it('drops a review whose card no longer exists — the forecast is current workload', () => {
            const orphan: ReviewState = review({ key: 'q:deleted#0', dueAt: '2026-08-26T00:00:00.000Z' });
            const extant: ReviewState = review({ key: 'q:q-1#0', dueAt: '2026-08-26T00:00:00.000Z' });

            const forecast = computeReviewForecast([orphan, extant], new Set(['q:q-1#0']), 7, refDate, timeZone);

            expect(forecast[1].date).toBe('2026-08-26');
            expect(forecast[1].dueCount).toBe(1);
            expect(forecast[forecast.length - 1].cumulativeDue).toBe(1);
        });

        it('returns empty array if daysAhead <= 0', () => {
            expect(computeReviewForecast([], new Set(), 0)).toEqual([]);
        });
    });

    describe('buildActivityCalendar() — historical, so NOT pool-scoped', () => {
        it('still counts a review belonging to a card that no longer exists', () => {
            // The forecast asks "what is coming?" and drops orphans; the calendar
            // asks "what happened?" and a review of a since-deleted card did
            // happen. Scoping the calendar to the pool would silently rewrite
            // study history.
            const lastReviewedAt = '2026-08-20T09:00:00.000Z';
            const orphan: ReviewState = review({ key: 'q:deleted#0', lastReviewedAt, reviewCount: 3 });

            const calendar = buildActivityCalendar([], [orphan], 7, refDate, timeZone);
            const day = calendar.find((d) => d.date === '2026-08-20');

            expect(day?.activeCardsCount).toBe(1);
            expect(day?.totalActivities).toBe(1);
        });
    });
});
