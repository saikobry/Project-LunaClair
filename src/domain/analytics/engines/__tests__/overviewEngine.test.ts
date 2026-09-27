import { describe, it, expect } from 'vitest';
import { computeStudyOverview } from '../overviewEngine';
import type { QuizSession } from '../../../quiz/models/QuizSession';
import type { ReviewState } from '../../../flashcards/engines/scheduler';

describe('overviewEngine', () => {
    const refDate = new Date('2026-08-25T12:00:00.000Z');
    const timeZone = 'UTC';

    it('returns zero metrics for empty sessions and reviews', () => {
        const metrics = computeStudyOverview([], [], new Set(), refDate, timeZone);
        expect(metrics).toEqual({
            quizzesCompleted: 0,
            totalAnsweredQuestions: 0,
            totalCorrectAnswers: 0,
            globalQuizAccuracy: 0,
            totalCardReviews: 0,
            cardsWithReviewHistory: 0,
            currentStreakDays: 0,
            longestStreakDays: 0,
        });
    });

    it('computes question-weighted global accuracy (not session-percentage average)', () => {
        // Session 1: 5 / 5 correct (100%)
        const s1: QuizSession = {
            id: 's1',
            quizId: 'q1',
            mode: 'practice',
            status: 'completed',
            questionSnapshots: {},
            answers: Array(5).fill(null).map((_, i) => ({
                questionId: `q1-${i}`,
                value: true,
                isCorrect: true,
                earnedPoints: 10,
            })),
            startedAt: '2026-08-24T10:00:00Z',
            completedAt: '2026-08-24T10:05:00Z',
        };

        // Session 2: 25 / 50 correct (50%)
        const s2: QuizSession = {
            id: 's2',
            quizId: 'q2',
            mode: 'exam',
            status: 'completed',
            questionSnapshots: {},
            answers: Array(50).fill(null).map((_, i) => ({
                questionId: `q2-${i}`,
                value: true,
                isCorrect: i < 25,
                earnedPoints: i < 25 ? 10 : 0,
            })),
            startedAt: '2026-08-25T08:00:00Z',
            completedAt: '2026-08-25T08:30:00Z',
        };

        const r1: ReviewState = {
            key: 'card-1',
            repetitions: 3,
            easeFactor: 2.5,
            intervalDays: 14,
            dueAt: '2026-09-08T00:00:00Z',
            lapses: 0,
            lastReviewedAt: '2026-08-25T08:35:00Z',
            reviewCount: 4,
        };

        const r2: ReviewState = {
            key: 'card-2',
            repetitions: 0,
            easeFactor: 2.5,
            intervalDays: 0,
            dueAt: '2026-08-25T00:00:00Z',
            lapses: 0,
            reviewCount: 0, // Unreviewed card
        };

        const metrics = computeStudyOverview([s1, s2], [r1, r2], new Set(['card-1', 'card-2']), refDate, timeZone);

        expect(metrics.quizzesCompleted).toBe(2);
        expect(metrics.totalAnsweredQuestions).toBe(55);
        expect(metrics.totalCorrectAnswers).toBe(30);
        // (30 / 55) * 100 = 54.55%
        expect(metrics.globalQuizAccuracy).toBe(54.55);

        // Flashcards: 4 total reviews from r1 + 0 from r2 = 4
        expect(metrics.totalCardReviews).toBe(4);
        // 1 card with reviewCount > 0 (r2 is in the pool but unreviewed)
        expect(metrics.cardsWithReviewHistory).toBe(1);

        // Streak: Active on 2026-08-24 and 2026-08-25 -> 2 days
        expect(metrics.currentStreakDays).toBe(2);
        expect(metrics.longestStreakDays).toBe(2);
    });

    it('counts only current cards toward "cards with history", but keeps stranded reviews in the history totals', () => {
        // A schedule for a card outside the active pool — its question archived,
        // deleted, or a cloze blank retired. It is a review that happened, so the
        // historical figures keep it, but it is not a card the learner has, so it
        // must not inflate a figure that sits beside the pool-scoped maturity bar.
        const stranded: ReviewState = {
            key: 'card-archived-9',
            repetitions: 6,
            easeFactor: 2.7,
            intervalDays: 1,
            dueAt: '2026-09-08T00:00:00Z',
            lapses: 0,
            lastReviewedAt: '2026-08-24T09:00:00Z',
            reviewCount: 6,
        };

        const current: ReviewState = {
            key: 'card-1',
            repetitions: 1,
            easeFactor: 2.5,
            intervalDays: 1,
            dueAt: '2026-08-26T00:00:00Z',
            lapses: 0,
            lastReviewedAt: '2026-08-25T08:35:00Z',
            reviewCount: 2,
        };

        const metrics = computeStudyOverview([], [current, stranded], new Set(['card-1']), refDate, timeZone);

        // Current-workload figure: one card in the pool, however many reviews.
        expect(metrics.cardsWithReviewHistory).toBe(1);
        // Historical figures: both reviews happened.
        expect(metrics.totalCardReviews).toBe(8);
        // The stranded review's day still counts toward the streak.
        expect(metrics.currentStreakDays).toBe(2);
    });

    it('does not mutate input arrays', () => {
        const sessions = Object.freeze([]) as readonly QuizSession[];
        const reviews = Object.freeze([]) as readonly ReviewState[];
        expect(() =>
            computeStudyOverview(sessions, reviews, new Set(), refDate, timeZone),
        ).not.toThrow();
    });
});
