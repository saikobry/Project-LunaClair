import { describe, expect, it } from 'vitest';
import { normalizeSourceSection } from '../sourceSection';

/**
 * `sourceSection` is provenance, not a tag, so it gets its own normalizer rather than
 * sharing `tags.ts` — the separation is what stops the field from being folded into tag
 * treatment later. The trimming rule is the same as `normalizeTags`: a blank label is
 * "not set", never a stored empty string.
 */
describe('normalizeSourceSection', () => {
    it('trims a real label and keeps it as authored', () => {
        expect(normalizeSourceSection('  Cell Organelles  ')).toBe('Cell Organelles');
    });

    it('treats a whitespace-only label as absent', () => {
        expect(normalizeSourceSection('   ')).toBeUndefined();
        expect(normalizeSourceSection('')).toBeUndefined();
    });

    it('passes an absent label straight through', () => {
        expect(normalizeSourceSection(undefined)).toBeUndefined();
    });

    it('rejects a non-string rather than stringifying it', () => {
        // A number or object reaching the write boundary is a broken caller, and coercing
        // it would persist a label the user never saw.
        expect(normalizeSourceSection(42 as unknown as string)).toBeUndefined();
        expect(normalizeSourceSection({} as unknown as string)).toBeUndefined();
    });
});
