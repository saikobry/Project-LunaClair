import type { Term } from '../../../domain/library/Term';
import type {
    TermRepository,
    CreateTermInput,
    UpdateTermInput,
} from '../../../domain/library/TermRepository';
import { db } from '../LunaClairDatabase';

function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

export class DexieTermRepository implements TermRepository {
    async getTerms(signal?: AbortSignal): Promise<Term[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.terms.toArray();
    }

    async getTermsBySubject(subjectId: string, signal?: AbortSignal): Promise<Term[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.terms.where('subjectId').equals(subjectId).toArray();
    }

    async getTermById(id: string, signal?: AbortSignal): Promise<Term | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await db.terms.get(id)) ?? null;
    }

    async createTerm(input: CreateTermInput): Promise<Term> {
        const now = new Date().toISOString();
        const term: Term = {
            id: generateId(),
            subjectId: input.subjectId,
            title: input.title,
            order: input.order,
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

    async deleteTerm(id: string): Promise<void> {
        await db.terms.delete(id);
    }
}

export const dexieTermRepository = new DexieTermRepository();
