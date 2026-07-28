import type { Subject } from '../../../domain/library/Subject';
import type {
    SubjectRepository,
    CreateSubjectInput,
    UpdateSubjectInput,
} from '../../../domain/library/SubjectRepository';
import { db } from '../LunaClairDatabase';

function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

export class DexieSubjectRepository implements SubjectRepository {
    async getSubjects(signal?: AbortSignal): Promise<Subject[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.subjects.toArray();
    }

    async getSubjectById(id: string, signal?: AbortSignal): Promise<Subject | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await db.subjects.get(id)) ?? null;
    }

    async createSubject(input: CreateSubjectInput): Promise<Subject> {
        const now = new Date().toISOString();
        const subject: Subject = {
            id: generateId(),
            title: input.title,
            description: input.description,
            createdAt: now,
            updatedAt: now,
        };
        await db.subjects.put(subject);
        return subject;
    }

    async updateSubject(id: string, input: UpdateSubjectInput): Promise<Subject> {
        const existing = await db.subjects.get(id);
        if (!existing) throw new Error(`Subject not found: ${id}`);

        const updated: Subject = {
            ...existing,
            ...input,
            updatedAt: new Date().toISOString(),
        };
        await db.subjects.put(updated);
        return updated;
    }

    async deleteSubject(id: string): Promise<void> {
        await db.subjects.delete(id);
    }
}

export const dexieSubjectRepository = new DexieSubjectRepository();
