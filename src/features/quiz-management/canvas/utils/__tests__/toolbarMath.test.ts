import { describe, it, expect } from 'vitest';
import { readVelocity, estimateCalloutHeight, CALLOUT_PADDING_VERTICAL, CALLOUT_LINE_HEIGHT, CALLOUT_CHARS_PER_LINE } from '../toolbarMath';

describe('toolbarMath', () => {
    describe('readVelocity', () => {
        it('returns initial velocity when now === sample.at', () => {
            const sample = { v: 100, at: 1000 };
            expect(readVelocity(sample, 1000)).toBeCloseTo(100);
        });

        it('exponentially decays velocity over time', () => {
            const sample = { v: 100, at: 1000 };
            // after 80ms (1 time constant tau), v should be 100 * exp(-1) ≈ 36.7879
            expect(readVelocity(sample, 1080)).toBeCloseTo(100 * Math.exp(-1), 4);
            // after 160ms (2 time constants), v should be 100 * exp(-2) ≈ 13.5335
            expect(readVelocity(sample, 1160)).toBeCloseTo(100 * Math.exp(-2), 4);
        });
    });

    describe('estimateCalloutHeight', () => {
        it('returns base padding when errors list is empty', () => {
            expect(estimateCalloutHeight([])).toBe(CALLOUT_PADDING_VERTICAL);
        });

        it('calculates height for short single-line error messages', () => {
            const errors = ['Short error message'];
            const expectedHeight = CALLOUT_PADDING_VERTICAL + 1 * CALLOUT_LINE_HEIGHT;
            expect(estimateCalloutHeight(errors)).toBe(expectedHeight);
        });

        it('calculates height for long multi-line error messages exceeding chars per line', () => {
            // A message longer than CALLOUT_CHARS_PER_LINE (90 chars)
            const longMessage = 'A'.repeat(CALLOUT_CHARS_PER_LINE + 10); // 100 chars -> 2 lines
            const errors = [longMessage];
            const expectedHeight = CALLOUT_PADDING_VERTICAL + 2 * CALLOUT_LINE_HEIGHT;
            expect(estimateCalloutHeight(errors)).toBe(expectedHeight);
        });

        it('aggregates lines across multiple error messages', () => {
            const errors = ['First error', 'Second error'];
            const expectedHeight = CALLOUT_PADDING_VERTICAL + 2 * CALLOUT_LINE_HEIGHT;
            expect(estimateCalloutHeight(errors)).toBe(expectedHeight);
        });
    });
});
