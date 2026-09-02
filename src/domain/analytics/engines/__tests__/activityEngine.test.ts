import { describe, it, expect } from 'vitest';
import { buildActivityCalendar, calculateIntensityLevel } from '../activityEngine';
import type { QuizSession } from '../../../quiz/models/QuizSession';
import type { ReviewState } from '../../../flashcards/engines/scheduler';

describe('activityEngine', () => {
    const refDate = new Date('2026-08-25T12:00:00.000Z');
    const timeZone = 'UTC';

    describe('calculateIntensityLevel()', () => {
        it('maps counts to expected discrete intensity levels', () => {
            expect(calculateIntensityLevel(0)).toBe(0);
            expect(calculateIntensityLevel(1)).toBe(1);
            expect(calculateIntensityLevel(2)).toBe(2);
            expect(calculateIntensityLevel(3)).toBe(2);
            expect(calculateIntensityLevel(4)).toBe(3);
            expect(calculateIntensityLevel(6)).toBe(3);
            expect(calculateIntensityLevel(7)).toBe(4);
            expect(calculateIntensityLevel(20)).toBe(4);
        });
    });

    describe('buildActivityCalendar()', () => {
        it('generates a full 365-day array covering every single date without gaps', () => {
            const calendar = buildActivityCalendar([], [], 365, refDate, timeZone);
            expect(calendar).toHaveLength(365);
            expect(calendar[0].date).toBe('2025-08-26');
            expect(calendar[364].date).toBe('2026-08-25');
            expect(calendar.every((d) => d.intensityLevel === 0)).toBe(true);
        });

        it('aggregates quiz sessions and active card review dates into correct date buckets', () => {
            const sessions: QuizSession[] = [
                {
                    id: 's1',
                    quizId: 'q1',
                    mode: 'practice',
                    status: 'completed',
                    questionSnapshots: {},
                    answers: [],
                    startedAt: '2026-08-24T10:00:00.000Z',
                    completedAt: '2026-08-24T10:05:00.000Z',
                },
                {
                    id: 's2',
                    quizId: 'q1',
                    mode: 'practice',
                    status: 'completed',
                    questionSnapshots: {},
                    answers: [],
                    startedAt: '2026-08-25T08:00:00.000Z',
                    completedAt: '2026-08-25T08:10:00.000Z',
                },
            ];

            const reviews: ReviewState[] = [
                {
                    key: 'card-1',
                    repetitions: 2,
                    easeFactor: 2.5,
                    intervalDays: 6,
                    dueAt: '2026-08-30T00:00:00.000Z',
                    lapses: 0,
                    lastReviewedAt: '2026-08-25T08:15:00.000Z',
                    reviewCount: 2,
                },
                {
                    key: 'card-2',
                    repetitions: 1,
                    easeFactor: 2.5,
                    intervalDays: 1,
                    dueAt: '2026-08-26T00:00:00.000Z',
                    lapses: 0,
                    lastReviewedAt: '2026-08-25T08:20:00.000Z',
                    reviewCount: 1,
                },
            ];

            const calendar = buildActivityCalendar(sessions, reviews, 7, refDate, timeZone);
            expect(calendar).toHaveLength(7);

            const day24 = calendar.find((d) => d.date === '2026-08-24');
            expect(day24).toBeDefined();
            expect(day24?.quizzesCount).toBe(1);
            expect(day24?.activeCardsCount).toBe(0);
            expect(day24?.totalActivities).toBe(1);
            expect(day24?.intensityLevel).toBe(1);

            const day25 = calendar.find((d) => d.date === '2026-08-25');
            expect(day25).toBeDefined();
            expect(day25?.quizzesCount).toBe(1);
            expect(day25?.activeCardsCount).toBe(2);
            expect(day25?.totalActivities).toBe(3);
            expect(day25?.intensityLevel).toBe(2);
        });

        it('does not mutate input sessions or reviews', () => {
            const sessions = Object.freeze([]) as readonly QuizSession[];
            const reviews = Object.freeze([]) as readonly ReviewState[];
            expect(() => buildActivityCalendar(sessions, reviews, 7, refDate, timeZone)).not.toThrow();
        });
    });
});
