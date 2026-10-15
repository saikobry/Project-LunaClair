import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type {
    LibraryRepository,
    CreateMaterialInput,
    UpdateMaterialInput,
} from '../../../domain/library/repositories/LibraryRepository';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../schema/LunaClairDatabase';
import { normalizeTags } from '../../../shared/utils/tags';

function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

export class DexieLibraryRepository implements LibraryRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = getActiveVaultDatabase()) {
        this.db = database;
    }

    async getMaterials(signal?: AbortSignal): Promise<StudyMaterial[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return this.db.materials.toArray();
    }

    async getMaterialById(id: string, signal?: AbortSignal): Promise<StudyMaterial | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await this.db.materials.get(id)) ?? null;
    }

    async createMaterial(input: CreateMaterialInput): Promise<StudyMaterial> {
        const now = new Date().toISOString();
        const material: StudyMaterial = {
            id: generateId(),
            title: input.title,
            description: input.description,
            documentId: input.documentId ?? generateId(),
            order: input.order,
            tags: normalizeTags(input.tags),
            createdAt: now,
            updatedAt: now,
        };
        await this.db.materials.put(material);
        return material;
    }

    async updateMaterial(id: string, input: UpdateMaterialInput): Promise<StudyMaterial> {
        const existing = await this.db.materials.get(id);
        if (!existing) throw new Error(`Material not found: ${id}`);

        const { tags, ...rest } = input;

        const updated: StudyMaterial = {
            ...existing,
            ...rest,
            ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}),
            updatedAt: new Date().toISOString(),
        };
        await this.db.materials.put(updated);
        return updated;
    }
}

export const dexieLibraryRepository = new DexieLibraryRepository();
