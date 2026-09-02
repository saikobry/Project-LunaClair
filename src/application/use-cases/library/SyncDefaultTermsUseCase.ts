import type { CatalogRepository } from '../../../domain/library/repositories/CatalogRepository';
import type { Term } from '../../../domain/library/models/Term';
import type { TermRepository } from '../../../domain/library/repositories/TermRepository';

export interface SyncDefaultTermsResult {
    synced: boolean;
    count: number;
}

/**
 * Syncs the canonical academic terms (Prelim / Midterm / Finals) from the
 * remote catalog into the local terms store — the payoff of finishing
 * first-run onboarding.
 *
 * Insert-if-missing by id: existing terms (including user edits) are never
 * overwritten, and re-running is a no-op. Failure-tolerant on the fetch:
 * when the catalog is unreachable (e.g. offline at onboarding completion)
 * it returns `{ synced: false }` and terms still arrive later via import,
 * which writes its own term rows. Persistence failures are NOT swallowed —
 * they surface as real errors.
 */
export class SyncDefaultTermsUseCase {
    private readonly catalog: CatalogRepository;
    private readonly terms: TermRepository;

    constructor(catalog: CatalogRepository, terms: TermRepository) {
        this.catalog = catalog;
        this.terms = terms;
    }

    async execute(signal?: AbortSignal): Promise<SyncDefaultTermsResult> {
        let catalogTerms: Term[];
        try {
            const catalog = await this.catalog.getCatalog(signal);
            catalogTerms = catalog.terms;
        } catch {
            return { synced: false, count: 0 };
        }

        const existing = await this.terms.getTerms(signal);
        const existingIds = new Set(existing.map((term) => term.id));
        const missing = catalogTerms.filter((term) => !existingIds.has(term.id));

        await this.terms.upsertTerms(missing);
        return { synced: true, count: missing.length };
    }
}
