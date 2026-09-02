import { describe, it, expect } from 'vitest';
import { computeStreak } from '../streakEngine';

describe('streakEngine', () => {
    const refDate = new Date('2026-08-25T12:00:00.000Z');
    const timeZone = 'UTC';

    it('returns zero streak for empty activity timestamps', () => {
        const res = computeStreak([], refDate, timeZone);
        expect(res).toEqual({
            currentStreak: 0,
            longestStreak: 0,
            lastActiveDate: undefined,
        });
    });

    it('calculates active streak when active today with consecutive prior days', () => {
        const timestamps = [
            '2026-08-23T10:00:00.000Z',
            '2026-08-24T15:00:00.000Z',
            '2026-08-25T08:00:00.000Z',
        ];
        const res = computeStreak(timestamps, refDate, timeZone);
        expect(res.currentStreak).toBe(3);
        expect(res.longestStreak).toBe(3);
        expect(res.lastActiveDate).toBe('2026-08-25');
    });

    it('preserves streak when active yesterday but not yet today (grace period)', () => {
        const timestamps = [
            '2026-08-23T10:00:00.000Z',
            '2026-08-24T15:00:00.000Z',
        ];
        const res = computeStreak(timestamps, refDate, timeZone);
        expect(res.currentStreak).toBe(2);
        expect(res.longestStreak).toBe(2);
        expect(res.lastActiveDate).toBe('2026-08-24');
    });

    it('resets current streak to 0 when last active was before yesterday, while preserving longest streak', () => {
        const timestamps = [
            '2026-08-20T10:00:00.000Z',
            '2026-08-21T10:00:00.000Z',
            '2026-08-22T10:00:00.000Z', // 3-day historical streak
            // Gap on 23rd, 24th, 25th
        ];
        const res = computeStreak(timestamps, refDate, timeZone);
        expect(res.currentStreak).toBe(0);
        expect(res.longestStreak).toBe(3);
        expect(res.lastActiveDate).toBe('2026-08-22');
    });

    it('handles multiple historical streaks and identifies the maximum peak', () => {
        const timestamps = [
            // Streak 1: 4 days
            '2026-08-01T10:00:00.000Z',
            '2026-08-02T10:00:00.000Z',
            '2026-08-03T10:00:00.000Z',
            '2026-08-04T10:00:00.000Z',
            // Gap
            // Streak 2: 2 days (current)
            '2026-08-24T10:00:00.000Z',
            '2026-08-25T10:00:00.000Z',
        ];
        const res = computeStreak(timestamps, refDate, timeZone);
        expect(res.currentStreak).toBe(2);
        expect(res.longestStreak).toBe(4);
    });

    it('deduplicates multiple activities on the same day without inflating streak', () => {
        const timestamps = [
            '2026-08-25T08:00:00.000Z',
            '2026-08-25T11:00:00.000Z',
            '2026-08-25T19:00:00.000Z',
        ];
        const res = computeStreak(timestamps, refDate, timeZone);
        expect(res.currentStreak).toBe(1);
        expect(res.longestStreak).toBe(1);
    });

    it('does not mutate input array', () => {
        const timestamps = Object.freeze([
            '2026-08-25T10:00:00.000Z',
            '2026-08-24T10:00:00.000Z',
        ]);
        expect(() => computeStreak(timestamps, refDate, timeZone)).not.toThrow();
    });
});
