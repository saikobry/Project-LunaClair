import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../schema/LunaClairDatabase';
import { DexieCollectionMaterialRepository, dexieCollectionMaterialRepository } from '../DexieCollectionMaterialRepository';

describe('DexieCollectionMaterialRepository', () => {
    let repo: DexieCollectionMaterialRepository;

    beforeEach(async () => {
        await db.collectionMaterials.clear();
        repo = dexieCollectionMaterialRepository;
    });

    afterEach(async () => {
        await db.collectionMaterials.clear();
    });

    it('auto-increments order on add and rejects duplicates', async () => {
        const first = await repo.add('c-1', 'm-1');
        expect(first.order).toBe(0);

        const second = await repo.add('c-1', 'm-2');
        expect(second.order).toBe(1);

        await expect(repo.add('c-1', 'm-1')).rejects.toThrow(
            'Material "m-1" is already in collection "c-1"',
        );
    });

    it('queries by collection and material with ordering', async () => {
        await repo.add('c-1', 'm-1');
        await repo.add('c-1', 'm-2');
        await repo.add('c-2', 'm-1');

        const byCollection = await repo.getByCollectionId('c-1');
        expect(byCollection.map((l) => l.materialId)).toEqual(['m-1', 'm-2']);

        const byMaterial = await repo.getByMaterialId('m-1');
        expect(byMaterial.map((l) => l.collectionId).sort()).toEqual(['c-1', 'c-2']);
    });

    it('reorders materials within a collection', async () => {
        await repo.add('c-1', 'm-1');
        await repo.add('c-1', 'm-2');
        await repo.add('c-1', 'm-3');

        await repo.reorder('c-1', ['m-3', 'm-1', 'm-2']);

        const links = await repo.getByCollectionId('c-1');
        expect(links.map((l) => l.materialId)).toEqual(['m-3', 'm-1', 'm-2']);
    });

    it('rejects reorder with mismatched membership', async () => {
        await repo.add('c-1', 'm-1');
        await expect(repo.reorder('c-1', ['m-1', 'm-unknown'])).rejects.toThrow(
            'reorder: orderedMaterialIds must contain every material in the collection',
        );
    });

    it('removes single links and bulk-removes by collection or material', async () => {
        await repo.add('c-1', 'm-1');
        await repo.add('c-1', 'm-2');
        await repo.add('c-2', 'm-1');

        await repo.remove('c-1', 'm-2');
        expect(await repo.getByCollectionId('c-1')).toHaveLength(1);

        await repo.removeByMaterialId('m-1');
        expect(await repo.getByCollectionId('c-1')).toHaveLength(0);
        expect(await repo.getByCollectionId('c-2')).toHaveLength(0);

        await repo.add('c-1', 'm-9');
        await repo.removeByCollectionId('c-1');
        expect(await repo.getByCollectionId('c-1')).toHaveLength(0);
    });

    it('respects abort signal', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(repo.getByCollectionId('c-1', controller.signal)).rejects.toThrow();
        await expect(repo.getByMaterialId('m-1', controller.signal)).rejects.toThrow();
    });
});
