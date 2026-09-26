import { describe, expect, it } from 'vitest';
import { cardKeyForBlank, cardKeyForQuestion } from '../cardKey';

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

describe('cardKeyForBlank', () => {
    it('builds the `q:<id>#<index>` per-blank key', () => {
        expect(cardKeyForBlank('q-test-1', 0)).toBe('q:q-test-1#0');
        expect(cardKeyForBlank('q-test-1', 1)).toBe('q:q-test-1#1');
        expect(cardKeyForBlank('q-test-1', 12)).toBe('q:q-test-1#12');
    });

    it('is stable across calls for the same question id and index', () => {
        expect(cardKeyForBlank('q1', 2)).toBe(cardKeyForBlank('q1', 2));
    });

    it('gives index 0 its own key rather than borrowing the whole-question key', () => {
        // The boundary case: `#0` is a real blank, not an absence of one, so a
        // single-blank question gets a key distinct from its own question id.
        expect(cardKeyForBlank('a', 0)).toBe('q:a#0');
        expect(cardKeyForQuestion('a')).toBe('q:a');
        expect(cardKeyForBlank('a', 0)).not.toBe(cardKeyForQuestion('a'));
    });

    it('never collides across blanks or across questions', () => {
        const keys = [
            cardKeyForQuestion('a'),
            cardKeyForBlank('a', 0),
            cardKeyForBlank('a', 1),
            cardKeyForBlank('b', 0),
        ];
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('is a total function — it never throws and never rejects an id', () => {
        expect(cardKeyForBlank('', 0)).toBe('q:#0');
        expect(cardKeyForBlank('a:b', 0)).toBe('q:a:b#0');
    });
});
