import type { Term } from '../../../domain/library/Term';
import type { SubjectTerm } from '../../../domain/library/SubjectTerm';
import type {
    TermService,
    CreateAndAssignTermResult,
} from '../../../domain/library/TermService';
import { db } from '../LunaClairDatabase';

function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

/**
 * Concrete `TermService` implementation backed by Dexie.
 *
 * `createAndAssignTerm` executes the global Term creation and the
 * Subject ↔ Term junction insert inside a single `db.transaction('rw')`
 * spanning the `terms` and `subjectTerms` stores, so the operation is
 * atomic — either both the Term and the junction land, or neither does.
 */
export class DexieTermService implements TermService {
    async createAndAssignTerm(
        subjectId: string,
        title: string,
    ): Promise<CreateAndAssignTermResult> {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            throw new Error('createAndAssignTerm: title must not be empty');
        }

        return db.transaction('rw', [db.terms, db.subjectTerms, db.subjects], async () => {
            // Validate subject exists before creating the term
            const subject = await db.subjects.get(subjectId);
            if (!subject) {
                throw new Error(`Subject not found: ${subjectId}`);
            }

            const now = new Date().toISOString();
            const term: Term = {
                id: generateId(),
                title: trimmedTitle,
                createdAt: now,
                updatedAt: now,
            };
            await db.terms.put(term);

            // Append with max(order) + 1 so the new term lands last
            const links = await db.subjectTerms
                .where('subjectId')
                .equals(subjectId)
                .toArray();
            const maxOrder = links.reduce((max, l) => Math.max(max, l.order), 0);

            const subjectTerm: SubjectTerm = {
                subjectId,
                termId: term.id,
                order: maxOrder + 1,
            };
            await db.subjectTerms.put(subjectTerm);

            return { term, subjectTerm };
        });
    }
}

export const dexieTermService = new DexieTermService();
