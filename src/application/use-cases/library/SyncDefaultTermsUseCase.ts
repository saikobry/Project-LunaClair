import type { Term } from '../../../domain/library/models/Term';
import { CANONICAL_DEFAULT_TERMS } from '../../../domain/library/models/term.types';
import type { TermRepository } from '../../../domain/library/repositories/TermRepository';

export interface SyncDefaultTermsResult {
    synced: boolean;
    count: number;
}

/**
 * Syncs the canonical academic terms (Prelim / Midterm / Finals) into the
 * local terms store — the payoff of finishing first-run onboarding.
 *
 * Insert-if-missing by id: existing terms (including user edits) are never
 * overwritten, and re-running is a no-op. The canonical terms are bundled
 * app constants (zero network dependency); persistence failures are NOT
 * swallowed — they surface as real errors.
 */
export class SyncDefaultTermsUseCase {
    private readonly terms: TermRepository;

    constructor(terms: TermRepository) {
        this.terms = terms;
    }

    async execute(signal?: AbortSignal): Promise<SyncDefaultTermsResult> {
        const existing = await this.terms.getTerms(signal);
        const existingIds = new Set(existing.map((term) => term.id));

        const now = new Date().toISOString();
        const missing: Term[] = CANONICAL_DEFAULT_TERMS.filter(
            (term) => !existingIds.has(term.id),
        ).map((term) => ({
            ...term,
            createdAt: now,
            updatedAt: now,
        }));

        await this.terms.upsertTerms(missing);
        return { synced: true, count: missing.length };
    }
}