/**
 * Pure helper for the question `sourceSection` provenance label.
 *
 * Deliberately NOT part of `tags.ts`: a section label is not a tag. Tags are
 * subject-matter classification a user filters on; `sourceSection` is a
 * one-off record of where a generated question came from. Keeping the
 * normalizer separate is what stops the field from quietly being folded into
 * tag treatment later.
 *
 * The same treatment `normalizeTags` gives: trim, and treat an empty result as
 * "not set", so a blank string never persists as a blank provenance.
 */
export function normalizeSourceSection(sourceSection: string | undefined): string | undefined {
    if (typeof sourceSection !== 'string') return undefined;
    const trimmed = sourceSection.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
