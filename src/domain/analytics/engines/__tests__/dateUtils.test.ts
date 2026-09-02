import { describe, it, expect } from 'vitest';
import { toLocalDateKey, parseInstant, addDays, diffCalendarDays, getCalendarDaysWindow } from '../dateUtils';

describe('dateUtils', () => {
    describe('toLocalDateKey()', () => {
        it('formats Date to YYYY-MM-DD in local time by default', () => {
            const date = new Date(2026, 7, 25); // August 25, 2026
            expect(toLocalDateKey(date)).toBe('2026-08-25');
        });

        it('respects explicit timezone parameter (UTC vs UTC+8)', () => {
            // 2026-08-24 18:00:00 UTC -> 2026-08-24 in UTC, but 2026-08-25 02:00:00 in Asia/Singapore (UTC+8)
            const utcString = '2026-08-24T18:00:00.000Z';
            expect(toLocalDateKey(utcString, 'UTC')).toBe('2026-08-24');
            expect(toLocalDateKey(utcString, 'Asia/Singapore')).toBe('2026-08-25');
        });

        it('handles leap year dates (Feb 29)', () => {
            const leapDate = new Date('2024-02-29T12:00:00Z');
            expect(toLocalDateKey(leapDate, 'UTC')).toBe('2024-02-29');
        });

        it('throws for invalid timestamp string', () => {
            expect(() => toLocalDateKey('not-a-date')).toThrow();
        });
    });

    describe('parseInstant()', () => {
        it('parses valid ISO string to Date object', () => {
            const d = parseInstant('2026-08-25T10:30:00.000Z');
            expect(d.toISOString()).toBe('2026-08-25T10:30:00.000Z');
        });

        it('throws for invalid ISO timestamp', () => {
            expect(() => parseInstant('invalid')).toThrow();
        });
    });

    describe('addDays()', () => {
        it('adds days across month boundaries', () => {
            const base = new Date('2026-08-31T00:00:00.000Z');
            const next = addDays(base, 1);
            expect(toLocalDateKey(next, 'UTC')).toBe('2026-09-01');
        });

        it('subtracts days when negative', () => {
            const base = new Date('2026-09-01T00:00:00.000Z');
            const prev = addDays(base, -1);
            expect(toLocalDateKey(prev, 'UTC')).toBe('2026-08-31');
        });
    });

    describe('diffCalendarDays()', () => {
        it('computes correct day difference', () => {
            expect(diffCalendarDays('2026-08-20', '2026-08-25')).toBe(5);
            expect(diffCalendarDays('2026-08-25', '2026-08-20')).toBe(-5);
            expect(diffCalendarDays('2026-08-25', '2026-08-25')).toBe(0);
        });

        it('computes day difference across month and leap-year boundaries', () => {
            expect(diffCalendarDays('2024-02-28', '2024-03-01')).toBe(2); // 2024 has Feb 29
        });
    });

    describe('getCalendarDaysWindow()', () => {
        it('returns empty array when daysCount <= 0', () => {
            expect(getCalendarDaysWindow(0)).toEqual([]);
            expect(getCalendarDaysWindow(-5)).toEqual([]);
        });

        it('returns contiguous 7-day array ending at referenceDate', () => {
            const ref = new Date('2026-08-25T12:00:00.000Z');
            const window = getCalendarDaysWindow(7, ref, 'UTC');
            expect(window).toEqual([
                '2026-08-19',
                '2026-08-20',
                '2026-08-21',
                '2026-08-22',
                '2026-08-23',
                '2026-08-24',
                '2026-08-25',
            ]);
        });
    });
});
