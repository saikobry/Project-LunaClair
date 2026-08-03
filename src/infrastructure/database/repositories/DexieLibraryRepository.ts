import type { StudyMaterial } from '../../../domain/library/StudyMaterial';
import type {
    LibraryRepository,
    CreateMaterialInput,
    UpdateMaterialInput,
} from '../../../domain/library/LibraryRepository';
import { db } from '../LunaClairDatabase';
import { dexieSubjectTermRepository } from './DexieSubjectTermRepository';

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
        // Validate term association: if termId is set, subjectId must be set and link must exist
        if (input.termId) {
            if (!input.subjectId) {
                throw new Error('createMaterial: subjectId is required when termId is set');
            }
            const exists = await dexieSubjectTermRepository.hasTerm(input.subjectId, input.termId);
            if (!exists) {
                throw new Error(
                    `createMaterial: term "${input.termId}" is not linked to subject "${input.subjectId}"`,
                );
            }
        }

        const now = new Date().toISOString();
        const material: StudyMaterial = {
            id: generateId(),
            title: input.title,
            description: input.description,
            sourceType: input.sourceType ?? 'bundled',
            sourceId: input.sourceId ?? generateId(),
            subjectId: input.subjectId,
            termId: input.termId,
            order: input.order,
            createdAt: now,
            updatedAt: now,
        };
        await db.materials.put(material);
        return material;
    }

    async updateMaterial(id: string, input: UpdateMaterialInput): Promise<StudyMaterial> {
        const existing = await db.materials.get(id);
        if (!existing) throw new Error(`Material not found: ${id}`);

        // Validate term association: if termId is being set/changed
        const resolvedTermId = input.termId !== undefined
            ? (input.termId ?? undefined)
            : existing.termId;

        const resolvedSubjectId = input.subjectId !== undefined
            ? (input.subjectId ?? undefined)
            : existing.subjectId;

        if (resolvedTermId) {
            if (!resolvedSubjectId) {
                throw new Error('updateMaterial: subjectId is required when termId is set');
            }
            const exists = await dexieSubjectTermRepository.hasTerm(resolvedSubjectId, resolvedTermId);
            if (!exists) {
                throw new Error(
                    `updateMaterial: term "${resolvedTermId}" is not linked to subject "${resolvedSubjectId}"`,
                );
            }
        }

        // Convert explicit null to undefined so IndexedDB stores the field as absent
        const { subjectId, termId, ...rest } = input;

        const updated: StudyMaterial = {
            ...existing,
            ...rest,
            ...(subjectId !== undefined ? { subjectId: subjectId ?? undefined } : {}),
            ...(termId !== undefined ? { termId: termId ?? undefined } : {}),
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
