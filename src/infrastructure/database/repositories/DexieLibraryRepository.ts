import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type {
    LibraryRepository,
    CreateMaterialInput,
    UpdateMaterialInput,
} from '../../../domain/library/repositories/LibraryRepository';
import { db } from '../schema/LunaClairDatabase';
import { normalizeTags } from '../../../domain/quiz/utils/tags';

function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

export class DexieLibraryRepository implements LibraryRepository {
    async getMaterials(signal?: AbortSignal): Promise<StudyMaterial[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.materials.toArray();
    }

    async getMaterialById(id: string, signal?: AbortSignal): Promise<StudyMaterial | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await db.materials.get(id)) ?? null;
    }

    async createMaterial(input: CreateMaterialInput): Promise<StudyMaterial> {
        const now = new Date().toISOString();
        const material: StudyMaterial = {
            id: generateId(),
            title: input.title,
            description: input.description,
            documentId: input.documentId ?? generateId(),
            subjectId: input.subjectId,
            termId: input.termId,
            order: input.order,
            tags: normalizeTags(input.tags),
            createdAt: now,
            updatedAt: now,
        };
        await db.materials.put(material);
        return material;
    }

    async updateMaterial(id: string, input: UpdateMaterialInput): Promise<StudyMaterial> {
        const existing = await db.materials.get(id);
        if (!existing) throw new Error(`Material not found: ${id}`);

        // Convert explicit null to undefined so IndexedDB stores the field as absent
        const { subjectId, termId, tags, ...rest } = input;

        const updated: StudyMaterial = {
            ...existing,
            ...rest,
            ...(subjectId !== undefined ? { subjectId: subjectId ?? undefined } : {}),
            ...(termId !== undefined ? { termId: termId ?? undefined } : {}),
            ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}),
            updatedAt: new Date().toISOString(),
        };
        await db.materials.put(updated);
        return updated;
    }

    async deleteMaterial(id: string): Promise<void> {
        await db.materials.delete(id);
    }
}

export const dexieLibraryRepository = new DexieLibraryRepository();
