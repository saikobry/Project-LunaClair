import { describe, expect, it } from 'vitest';
import { cardKeyForQuestion } from '../cardKey';

describe('cardKeyForQuestion', () => {
    it('builds the historical `q:`-prefixed key', () => {
        // Regression guard: review state is persisted under these keys, so the
        // literal format must never drift from the pre-helper convention.
        expect(cardKeyForQuestion('q-test-1')).toBe('q:q-test-1');
    });

    it('is stable across calls for the same question id', () => {
        expect(cardKeyForQuestion('q1')).toBe(cardKeyForQuestion('q1'));
    });

    it('is a total function — every id is prefixed, never rejected', () => {
        expect(cardKeyForQuestion('abc')).toBe('q:abc');
        expect(cardKeyForQuestion('')).toBe('q:');
        expect(cardKeyForQuestion('a:b')).toBe('q:a:b');
    });
});
