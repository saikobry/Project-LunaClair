import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../schema/LunaClairDatabase';
import { DexieCollectionRepository, dexieCollectionRepository } from '../DexieCollectionRepository';
import type { Collection } from '../../../../domain/collections/models/Collection';

describe('DexieCollectionRepository', () => {
    let repo: DexieCollectionRepository;

    beforeEach(async () => {
        await Promise.all([db.collections.clear(), db.collectionMaterials.clear()]);
        repo = dexieCollectionRepository;
    });

    afterEach(async () => {
        await Promise.all([db.collections.clear(), db.collectionMaterials.clear()]);
    });

    function seed(id: string, order: number): Collection {
        const now = '2026-09-01T00:00:00.000Z';
        return { id, title: `Collection ${id}`, order, createdAt: now, updatedAt: now };
    }

    it('performs CRUD operations on collections', async () => {
        const created = await repo.create(seed('c-1', 0));
        expect(created.id).toBe('c-1');

        const found = await repo.getById('c-1');
        expect(found).toEqual(created);

        const all = await repo.getAll();
        expect(all).toHaveLength(1);

        const updated = await repo.update('c-1', { title: 'Renamed' });
        expect(updated.title).toBe('Renamed');
        expect(await repo.getById('c-1')).not.toBeNull();
    });

    it('throws when updating a missing collection', async () => {
        await expect(repo.update('missing', { title: 'x' })).rejects.toThrow('Collection not found: missing');
    });

    it('reorders collections sequentially', async () => {
        await repo.create(seed('c-1', 0));
        await repo.create(seed('c-2', 1));
        await repo.create(seed('c-3', 2));

        await repo.reorder(['c-3', 'c-1', 'c-2']);

        expect((await repo.getById('c-3'))?.order).toBe(0);
        expect((await repo.getById('c-1'))?.order).toBe(1);
        expect((await repo.getById('c-2'))?.order).toBe(2);
    });

    it('atomically deletes the collection and its junction records', async () => {
        await repo.create(seed('c-1', 0));
        await repo.create(seed('c-2', 1));
        await db.collectionMaterials.bulkAdd([
            { collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: '2026-09-01T00:00:00.000Z' },
            { collectionId: 'c-1', materialId: 'm-2', order: 1, addedAt: '2026-09-01T00:00:00.000Z' },
            { collectionId: 'c-2', materialId: 'm-1', order: 0, addedAt: '2026-09-01T00:00:00.000Z' },
        ]);

        await repo.delete('c-1');

        expect(await repo.getById('c-1')).toBeNull();
        expect(await db.collectionMaterials.where('collectionId').equals('c-1').toArray()).toHaveLength(0);
        expect(await db.collectionMaterials.where('collectionId').equals('c-2').toArray()).toHaveLength(1);
    });

    it('respects abort signal', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(repo.getAll(controller.signal)).rejects.toThrow();
        await expect(repo.getById('c-1', controller.signal)).rejects.toThrow();
    });
});
