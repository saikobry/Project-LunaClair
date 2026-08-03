import type { Term } from '../../../domain/library/Term';
import type { SubjectTermView } from '../../../domain/library/SubjectTerm';
import type { SubjectTermRepository } from '../../../domain/library/SubjectTermRepository';
import { db } from '../LunaClairDatabase';

export class DexieSubjectTermRepository implements SubjectTermRepository {
    async getTermsBySubject(subjectId: string, signal?: AbortSignal): Promise<Term[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const links = await db.subjectTerms
            .where('subjectId')
            .equals(subjectId)
            .sortBy('order');

        const termIds = links.map((l) => l.termId);
        if (termIds.length === 0) return [];

        const terms = await db.terms.bulkGet(termIds);
        return terms.filter((t): t is Term => t !== undefined);
    }

    async getSubjectTermViews(subjectId: string, signal?: AbortSignal): Promise<SubjectTermView[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const links = await db.subjectTerms
            .where('subjectId')
            .equals(subjectId)
            .sortBy('order');

        const termIds = links.map((l) => l.termId);
        if (termIds.length === 0) return [];

        const terms = await db.terms.bulkGet(termIds);
        return links
            .map((link) => {
                const term = terms.find((t) => t?.id === link.termId);
                return term ? { term, order: link.order } : null;
            })
            .filter((v): v is SubjectTermView => v !== null);
    }

    async getSubjectIdsByTerm(termId: string, signal?: AbortSignal): Promise<string[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const links = await db.subjectTerms
            .where('termId')
            .equals(termId)
            .toArray();

        return links.map((l) => l.subjectId);
    }

    async syncTerms(subjectId: string, termIds: string[]): Promise<void> {
        // Validate no duplicate term IDs in the input
        const unique = new Set(termIds);
        if (unique.size !== termIds.length) {
            throw new Error('syncTerms: duplicate term IDs in input array');
        }

        await db.transaction('rw', [db.subjectTerms, db.terms, db.subjects], async () => {
            // Verify subject exists
            const subject = await db.subjects.get(subjectId);
            if (!subject) throw new Error(`Subject not found: ${subjectId}`);

            // Verify all terms exist
            const terms = await db.terms.bulkGet(termIds);
            for (let i = 0; i < termIds.length; i++) {
                if (!terms[i]) throw new Error(`Term not found: ${termIds[i]}`);
            }

            // Remove existing links for this subject
            const existing = await db.subjectTerms
                .where('subjectId')
                .equals(subjectId)
                .toArray();

            await db.subjectTerms.bulkDelete(
                existing.map((l) => [l.subjectId, l.termId] as [string, string]),
            );

            // Insert new links with sequential order
            const links = termIds.map((termId, index) => ({
                subjectId,
                termId,
                order: index + 1,
            }));

            await db.subjectTerms.bulkPut(links);
        });
    }

    async reorderTerms(subjectId: string, orderedTermIds: string[]): Promise<void> {
        await db.transaction('rw', db.subjectTerms, async () => {
            const existing = await db.subjectTerms
                .where('subjectId')
                .equals(subjectId)
                .toArray();

            // Validate that orderedTermIds contains every linked term
            const existingIds = new Set(existing.map((l) => l.termId));
            const orderedSet = new Set(orderedTermIds);
            if (existingIds.size !== orderedSet.size || ![...existingIds].every((id) => orderedSet.has(id))) {
                throw new Error('reorderTerms: orderedTermIds must contain every term linked to the subject');
            }

            // Update order on each matching row
            for (const existingLink of existing) {
                const newOrder = orderedTermIds.indexOf(existingLink.termId) + 1;
                if (newOrder === 0) continue; // shouldn't happen due to validation above
                await db.subjectTerms.put({
                    ...existingLink,
                    order: newOrder,
                });
            }
        });
    }

    async addTerm(subjectId: string, termId: string): Promise<void> {
        await db.transaction('rw', [db.subjectTerms, db.terms, db.subjects], async () => {
            // Validate subject exists
            const subject = await db.subjects.get(subjectId);
            if (!subject) throw new Error(`Subject not found: ${subjectId}`);

            // Validate term exists
            const term = await db.terms.get(termId);
            if (!term) throw new Error(`Term not found: ${termId}`);

            // Validate link does not already exist
            const existing = await db.subjectTerms.get([subjectId, termId]);
            if (existing) throw new Error(`Term "${termId}" is already linked to subject "${subjectId}"`);

            // Compute max order + 1
            const links = await db.subjectTerms
                .where('subjectId')
                .equals(subjectId)
                .toArray();

            const maxOrder = links.reduce((max, l) => Math.max(max, l.order), 0);

            await db.subjectTerms.put({
                subjectId,
                termId,
                order: maxOrder + 1,
            });
        });
    }

    async removeTerm(subjectId: string, termId: string): Promise<void> {
        await db.subjectTerms.delete([subjectId, termId]);
    }

    async hasTerm(subjectId: string, termId: string): Promise<boolean> {
        const entry = await db.subjectTerms.get([subjectId, termId]);
        return entry !== undefined;
    }
}

export const dexieSubjectTermRepository = new DexieSubjectTermRepository();
