import type { Term } from '../../../domain/library/models/Term';
import type { SubjectTerm } from '../../../domain/library/models/SubjectTerm';
import type {
    TermService,
    CreateAndAssignTermResult,
} from '../../../domain/library/services/TermService';
import { db as defaultDb, type LunaClairDatabase } from '../schema/LunaClairDatabase';

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
    private readonly db: LunaClairDatabase;

    constructor(db: LunaClairDatabase = defaultDb) {
        this.db = db;
    }

    async createAndAssignTerm(
        subjectId: string,
        title: string,
    ): Promise<CreateAndAssignTermResult> {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            throw new Error('createAndAssignTerm: title must not be empty');
        }

        return this.db.transaction('rw', [this.db.terms, this.db.subjectTerms, this.db.subjects], async () => {
            // Validate subject exists before creating the term
            const subject = await this.db.subjects.get(subjectId);
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
            await this.db.terms.put(term);

            // Append with max(order) + 1 so the new term lands last
            const links = await this.db.subjectTerms
                .where('subjectId')
                .equals(subjectId)
                .toArray();
            const maxOrder = links.reduce((max, l) => Math.max(max, l.order), 0);

            const subjectTerm: SubjectTerm = {
                subjectId,
                termId: term.id,
                order: maxOrder + 1,
            };
            await this.db.subjectTerms.put(subjectTerm);

            return { term, subjectTerm };
        });
    }
}

export const dexieTermService = new DexieTermService();
