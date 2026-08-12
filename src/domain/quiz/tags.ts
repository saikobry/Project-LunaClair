/**
 * Pure tag helpers — the single source of truth for tag tokenization and
 * normalization across every tag-entry surface.
 *
 * Casing policy (case-preserving display): the STORED string keeps the first
 * casing seen (a tag entered as "iOS" is stored and displayed as "iOS"), while
 * the canonical key used for dedup/comparison is derived (lowercased). The
 * canonical key is never persisted.
 */

/** Splits raw tag-entry text into tokens on commas (bulk paste / comma typing). */
export function splitTagInput(text: string): string[] {
    return text.split(',').map((t) => t.trim()).filter(Boolean);
}

/** Canonical key — case-insensitive, so 'iOS' and 'ios' are the same tag. */
export function tagKey(tag: string): string {
    return tag.trim().toLowerCase();
}

/** Cleans a single token: trims, strips a leading '#'; returns null when empty. */
function cleanTagToken(tag: string): string | null {
    const cleaned = tag.trim().replace(/^#/, '');
    return cleaned.length > 0 ? cleaned : null;
}

/**
 * Normalizes a tag list: trims, strips a leading '#', drops empties, and dedups
 * case-insensitively while preserving the FIRST casing seen.
 *
 * Returns `undefined` for absent/empty input so the "no tags" state is preserved
 * by callers that treat `undefined` as "not set".
 */
export function normalizeTags(tags: string[] | undefined): string[] | undefined {
    if (!tags || tags.length === 0) return undefined;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tag of tags) {
        const cleaned = cleanTagToken(tag);
        if (!cleaned) continue;
        const key = tagKey(cleaned);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(cleaned);
    }
    return out.length > 0 ? out : undefined;
}

/** Appends incoming tokens to an existing tag list, preserving first-seen casing. */
export function mergeTags(existing: string[] | undefined, incoming: string[]): string[] {
    return normalizeTags([...(existing ?? []), ...incoming]) ?? [];
}
