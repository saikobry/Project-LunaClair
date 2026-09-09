import type { Collection, UpdateCollectionInput } from '../../../domain/collections/models/Collection';
import type { CollectionRepository } from '../../../domain/collections/repositories/CollectionRepository';
import { db, type LunaClairDatabase } from '../schema/LunaClairDatabase';

export class DexieCollectionRepository implements CollectionRepository {
    private readonly database: LunaClairDatabase;

    constructor(database: LunaClairDatabase = db) {
        this.database = database;
    }

    async getAll(signal?: AbortSignal): Promise<Collection[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return this.database.collections.orderBy('order').toArray();
    }

    async getById(id: string, signal?: AbortSignal): Promise<Collection | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await this.database.collections.get(id)) ?? null;
    }

    async create(collection: Collection): Promise<Collection> {
        await this.database.collections.put(collection);
        return collection;
    }

    async update(id: string, patch: UpdateCollectionInput): Promise<Collection> {
        const existing = await this.database.collections.get(id);
        if (!existing) throw new Error(`Collection not found: ${id}`);

        const updated: Collection = {
            ...existing,
            ...patch,
            id: existing.id,
            order: existing.order,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
        };
        await this.database.collections.put(updated);
        return updated;
    }

    async delete(id: string): Promise<void> {
        await this.database.transaction('rw', [this.database.collections, this.database.collectionMaterials], async () => {
            await this.database.collections.delete(id);
            const links = await this.database.collectionMaterials
                .where('collectionId')
                .equals(id)
                .toArray();
            const keys = links.map((l) => l.id).filter((k): k is number => k !== undefined);
            if (keys.length > 0) {
                await this.database.collectionMaterials.bulkDelete(keys);
            }
        });
    }

    async reorder(orderedIds: string[]): Promise<void> {
        await this.database.transaction('rw', this.database.collections, async () => {
            const now = new Date().toISOString();
            const existing = await Promise.all(orderedIds.map((cid) => this.database.collections.get(cid)));
            const puts = existing.flatMap((collection, order) =>
                collection ? [{ ...collection, order, updatedAt: now }] : [],
            );
            if (puts.length > 0) {
                await this.database.collections.bulkPut(puts);
            }
        });
    }
}

export const dexieCollectionRepository = new DexieCollectionRepository();
