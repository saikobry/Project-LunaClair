import { describe, it, expect } from 'vitest';
import { describeDeckEmptyState, formatNextDueLabel } from '../describeDeckEmptyState';

/** Fixed reference instant — nothing here reads the wall clock or the host zone. */
const NOW = new Date('2026-09-27T12:00:00.000Z');
const UTC = 'UTC';

function ms(iso: string): number {
    return new Date(iso).getTime();
}

describe('formatNextDueLabel', () => {
    it('reads every relative label off the two instants, whatever zone the host runs in', () => {
        // No zone argument at all: the ladder must not need one, so these literals
        // hold on a developer machine and on CI regardless of local time.
        expect(formatNextDueLabel(ms('2026-09-27T12:30:00.000Z'), NOW)).toBe('in 30 minutes');
        expect(formatNextDueLabel(ms('2026-09-27T13:00:00.000Z'), NOW)).toBe('in 1 hour');
        expect(formatNextDueLabel(ms('2026-09-27T18:00:00.000Z'), NOW)).toBe('in 6 hours');
        expect(formatNextDueLabel(ms('2026-09-28T13:00:00.000Z'), NOW)).toBe('tomorrow');
        expect(formatNextDueLabel(ms('2026-09-30T12:00:00.000Z'), NOW)).toBe('in 3 days');
        expect(formatNextDueLabel(ms('2026-10-04T12:00:00.000Z'), NOW)).toBe('in 7 days');
    });

    it('keeps the same label when a far-off zone is supplied', () => {
        expect(formatNextDueLabel(ms('2026-09-27T18:00:00.000Z'), NOW, 'Pacific/Auckland')).toBe(
            'in 6 hours'
        );
        expect(formatNextDueLabel(ms('2026-09-27T18:00:00.000Z'), NOW, 'America/New_York')).toBe(
            'in 6 hours'
        );
    });

    it('falls back to a weekday date past a week out, in the zone it is given', () => {
        expect(formatNextDueLabel(ms('2026-10-14T12:00:00.000Z'), NOW, UTC)).toBe('Wed 14 Oct');
        // 22:00Z is already the 15th in Auckland, so the date label is the one
        // place the viewer's zone legitimately decides the answer.
        expect(formatNextDueLabel(ms('2026-10-14T22:00:00.000Z'), NOW, UTC)).toBe('Wed 14 Oct');
        expect(formatNextDueLabel(ms('2026-10-14T22:00:00.000Z'), NOW, 'Pacific/Auckland')).toBe(
            'Thu 15 Oct'
        );
    });

    it('never quotes a past instant as a future one', () => {
        expect(formatNextDueLabel(ms('2026-09-27T12:00:00.000Z'), NOW)).toBe('now');
        expect(formatNextDueLabel(ms('2026-09-01T12:00:00.000Z'), NOW)).toBe('now');
    });
});

describe('describeDeckEmptyState', () => {
    it('quotes the real next due time when nothing is due', () => {
        const message = describeDeckEmptyState(
            { kind: 'nothing_due', nextDueAt: '2026-09-27T18:00:00.000Z' },
            { now: NOW }
        );

        expect(message).toBe('Nothing due right now — the next card is due in 6 hours.');
    });

    it('names the next day rather than a 25-hour figure', () => {
        const message = describeDeckEmptyState(
            { kind: 'nothing_due', nextDueAt: '2026-09-28T13:00:00.000Z' },
            { now: NOW }
        );

        expect(message).toBe('Nothing due right now — the next card is due tomorrow.');
    });

    it('says so plainly when no card carries a readable due date', () => {
        expect(
            describeDeckEmptyState({ kind: 'nothing_due', nextDueAt: null }, { now: NOW })
        ).toBe('Nothing due right now, and none of these cards has a scheduled due date yet.');

        expect(
            describeDeckEmptyState({ kind: 'nothing_due', nextDueAt: 'not-a-date' }, { now: NOW })
        ).toBe('Nothing due right now, and none of these cards has a scheduled due date yet.');
    });

    it('names the quiz whose filter yields no cards, and points at the filter', () => {
        const message = describeDeckEmptyState(
            { kind: 'no_cards_in_selection', scopeTitle: 'Empty Quiz' },
            { now: NOW }
        );

        expect(message).toBe(
            'Empty Quiz has no flashcards to study. Change the Quiz Filter, or select All Quizzes, to start a session.'
        );
    });

    it('falls back to a scope-free sentence when no quiz named the scope', () => {
        const message = describeDeckEmptyState(
            { kind: 'no_cards_in_selection', scopeTitle: null },
            { now: NOW }
        );

        expect(message).toBe(
            'This selection has no flashcards to study. Change the Quiz Filter, or select All Quizzes, to start a session.'
        );
    });
});
