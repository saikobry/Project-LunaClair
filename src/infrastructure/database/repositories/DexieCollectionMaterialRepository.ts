import type { CollectionMaterial } from '../../../domain/collections/models/CollectionMaterial';
import type { CollectionMaterialRepository } from '../../../domain/collections/repositories/CollectionMaterialRepository';
import { db, type LunaClairDatabase } from '../schema/LunaClairDatabase';

export class DexieCollectionMaterialRepository implements CollectionMaterialRepository {
    private readonly database: LunaClairDatabase;

    constructor(database: LunaClairDatabase = db) {
        this.database = database;
    }

    async getByCollectionId(collectionId: string, signal?: AbortSignal): Promise<CollectionMaterial[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return this.database.collectionMaterials.where('collectionId').equals(collectionId).sortBy('order');
    }

    async getByMaterialId(materialId: string, signal?: AbortSignal): Promise<CollectionMaterial[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return this.database.collectionMaterials.where('materialId').equals(materialId).toArray();
    }

    async add(collectionId: string, materialId: string, order?: number): Promise<CollectionMaterial> {
        const existing = await this.database.collectionMaterials
            .where('[collectionId+materialId]')
            .equals([collectionId, materialId])
            .first();
        if (existing) {
            throw new Error(`Material "${materialId}" is already in collection "${collectionId}"`);
        }

        let nextOrder = order;
        if (nextOrder === undefined) {
            const links = await this.database.collectionMaterials
                .where('collectionId')
                .equals(collectionId)
                .toArray();
            nextOrder = links.reduce((max, l) => Math.max(max, l.order), -1) + 1;
        }

        const record: CollectionMaterial = {
            collectionId,
            materialId,
            order: nextOrder,
            addedAt: new Date().toISOString(),
        };
        const id = await this.database.collectionMaterials.add(record);
        return { ...record, id: id as number };
    }

    async remove(collectionId: string, materialId: string): Promise<void> {
        const existing = await this.database.collectionMaterials
            .where('[collectionId+materialId]')
            .equals([collectionId, materialId])
            .first();
        if (existing?.id !== undefined) {
            await this.database.collectionMaterials.delete(existing.id);
        }
    }

    async reorder(collectionId: string, orderedMaterialIds: string[]): Promise<void> {
        await this.database.transaction('rw', this.database.collectionMaterials, async () => {
            const existing = await this.database.collectionMaterials
                .where('collectionId')
                .equals(collectionId)
                .toArray();

            const existingIds = new Set(existing.map((l) => l.materialId));
            const orderedSet = new Set(orderedMaterialIds);
            if (existingIds.size !== orderedSet.size || ![...existingIds].every((id) => orderedSet.has(id))) {
                throw new Error('reorder: orderedMaterialIds must contain every material in the collection');
            }

            const updates = existing.map((link) => ({
                ...link,
                order: orderedMaterialIds.indexOf(link.materialId),
            }));
            await this.database.collectionMaterials.bulkPut(updates);
        });
    }

    async removeByCollectionId(collectionId: string): Promise<void> {
        const links = await this.database.collectionMaterials
            .where('collectionId')
            .equals(collectionId)
            .toArray();
        const keys = links.map((l) => l.id).filter((k): k is number => k !== undefined);
        if (keys.length > 0) {
            await this.database.collectionMaterials.bulkDelete(keys);
        }
    }

    async removeByMaterialId(materialId: string): Promise<void> {
        const links = await this.database.collectionMaterials
            .where('materialId')
            .equals(materialId)
            .toArray();
        const keys = links.map((l) => l.id).filter((k): k is number => k !== undefined);
        if (keys.length > 0) {
            await this.database.collectionMaterials.bulkDelete(keys);
        }
    }
}

export const dexieCollectionMaterialRepository = new DexieCollectionMaterialRepository();
