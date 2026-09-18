import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../schema/LunaClairDatabase';
import { DexieAssetRepository, dexieAssetRepository } from '../DexieAssetRepository';
import type { StoredAsset } from '../../../../domain/assets/repositories/AssetRepository';

/**
 * Note on the payload column: this suite asserts identity, grouping, and record fidelity, not
 * Blob bytes. Under jsdom + fake-indexeddb a stored Blob reads back as a plain object with its
 * bytes dropped — a test-environment limit, not product behavior. Byte-level fidelity is covered
 * by `src/application/use-cases/package/__tests__/packageRoundtripBytes.test.ts`, which runs
 * under Vitest's `node` environment where the real Blob survives IndexedDB intact.
 */
describe('DexieAssetRepository', () => {
    let reader: DexieAssetRepository;

    beforeEach(async () => {
        await db.localAssets.clear();
        reader = dexieAssetRepository;
    });

    afterEach(async () => {
        await db.localAssets.clear();
    });

    function seed(assetId: string, materialId: string, filename: string): StoredAsset {
        return {
            assetId,
            materialId,
            blob: new Blob([`bytes:${assetId}`], { type: 'image/png' }),
            mimeType: 'image/png',
            filename,
            importedAt: '2026-09-01T00:00:00.000Z',
        };
    }

    it('resolves exactly one asset by its own identity', async () => {
        await db.localAssets.bulkPut([
            seed('asset-a', 'mat-1', 'figure-a.png'),
            seed('asset-b', 'mat-1', 'figure-b.png'),
        ]);

        const found = await reader.get('asset-b');
        expect(found?.assetId).toBe('asset-b');
        expect(found?.materialId).toBe('mat-1');
        expect(found?.filename).toBe('figure-b.png');
        expect(found?.blob).toBeDefined();
    });

    it('returns undefined for an unknown asset id', async () => {
        expect(await reader.get('missing')).toBeUndefined();
    });

    it('groups N assets of one material without collapsing them into a single row', async () => {
        const assets = [
            seed('asset-a', 'mat-1', 'figure-a.png'),
            seed('asset-b', 'mat-1', 'figure-b.png'),
            seed('asset-c', 'mat-1', 'figure-c.png'),
        ];
        await db.localAssets.bulkPut(assets);

        const grouped = await reader.getByMaterialId('mat-1');
        expect(grouped).toHaveLength(3);
        expect(grouped.map((a) => a.assetId).sort()).toEqual(['asset-a', 'asset-b', 'asset-c']);

        // Each identity still resolves to its own record after bulk grouping.
        for (const asset of assets) {
            const resolved = await reader.get(asset.assetId);
            expect(resolved?.assetId).toBe(asset.assetId);
            expect(resolved?.filename).toBe(asset.filename);
        }
    });

    it('keeps materials separate even when two assets share a filename', async () => {
        await db.localAssets.bulkPut([
            seed('asset-1', 'mat-1', 'figure.png'),
            seed('asset-2', 'mat-2', 'figure.png'),
        ]);

        expect(await reader.getByMaterialId('mat-1')).toHaveLength(1);
        expect(await reader.getByMaterialId('mat-2')).toHaveLength(1);
        expect((await reader.get('asset-2'))?.materialId).toBe('mat-2');
    });

    it('returns an empty array for a material with no assets', async () => {
        expect(await reader.getByMaterialId('mat-empty')).toEqual([]);
    });
});
