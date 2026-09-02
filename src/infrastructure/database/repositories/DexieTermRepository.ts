import type { Term } from '../../../domain/library/models/Term';
import type {
    TermRepository,
    CreateTermInput,
    UpdateTermInput,
} from '../../../domain/library/repositories/TermRepository';
import { db } from '../LunaClairDatabase';

function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

export class DexieTermRepository implements TermRepository {
    async getTerms(signal?: AbortSignal): Promise<Term[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.terms.toArray();
    }

    async getTermById(id: string, signal?: AbortSignal): Promise<Term | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await db.terms.get(id)) ?? null;
    }

    async createTerm(input: CreateTermInput): Promise<Term> {
        const now = new Date().toISOString();
        const term: Term = {
            id: generateId(),
            title: input.title,
            createdAt: now,
            updatedAt: now,
        };
        await db.terms.put(term);
        return term;
    }

    async updateTerm(id: string, input: UpdateTermInput): Promise<Term> {
        const existing = await db.terms.get(id);
        if (!existing) throw new Error(`Term not found: ${id}`);

        const updated: Term = {
            ...existing,
            ...input,
            updatedAt: new Date().toISOString(),
        };
        await db.terms.put(updated);
        return updated;
    }

    async upsertTerms(terms: Term[]): Promise<void> {
        if (terms.length === 0) return;
        await db.terms.bulkPut(terms);
    }

    async deleteTerm(id: string): Promise<void> {
        await db.transaction('rw', [db.terms, db.subjectTerms, db.materials], async () => {
            // Remove all SubjectTerm junction rows referencing this term
            const links = await db.subjectTerms
                .where('termId')
                .equals(id)
                .toArray();

            if (links.length > 0) {
                await db.subjectTerms.bulkDelete(
                    links.map((l) => [l.subjectId, l.termId] as [string, string]),
                );
            }

            // Clear termId on any materials referencing this term
            const materials = await db.materials
                .where('termId')
                .equals(id)
                .toArray();

            if (materials.length > 0) {
                const now = new Date().toISOString();
                const updated = materials.map((m) => ({ ...m, termId: undefined, updatedAt: now }));
                await db.materials.bulkPut(updated);
            }

            // Delete the term itself
            await db.terms.delete(id);
        });
    }
}

export const dexieTermRepository = new DexieTermRepository();
