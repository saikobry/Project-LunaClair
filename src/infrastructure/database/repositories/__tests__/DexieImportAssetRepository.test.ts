import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../schema/LunaClairDatabase';
import { DexieImportAssetRepository, dexieImportAssetRepository } from '../DexieImportAssetRepository';
import type { ImportedAsset } from '../../../../domain/importer/repositories/ImportAssetRepository';

/**
 * Blob payload columns are asserted as present, not byte-compared: under jsdom +
 * fake-indexeddb a stored Blob reads back as a plain object with its bytes dropped (a
 * test-environment limit — browsers store Blobs natively).
 *
 * Removal and multi-asset reads are covered elsewhere: removal by
 * `DexieLibraryImportService.test.ts` (it owns that transaction), reads by
 * `DexieAssetRepository.test.ts`.
 */
describe('DexieImportAssetRepository', () => {
    let repo: DexieImportAssetRepository;

    beforeEach(async () => {
        await db.localAssets.clear();
        repo = dexieImportAssetRepository;
    });

    afterEach(async () => {
        await db.localAssets.clear();
    });

    function seedImported(materialId: string, filename: string): ImportedAsset {
        return {
            materialId,
            blob: new Blob([`bytes:${filename}`], { type: 'application/pdf' }),
            mimeType: 'application/pdf',
            filename,
            importedAt: '2026-09-01T00:00:00.000Z',
        };
    }

    it('writes the row under assetId === materialId (importer stays 1:1)', async () => {
        await repo.put(seedImported('mat-1', 'lecture.pdf'));

        const raw = await db.localAssets.get('mat-1');
        expect(raw?.assetId).toBe('mat-1');
        expect(raw?.materialId).toBe('mat-1');
        expect(raw?.filename).toBe('lecture.pdf');
        expect(raw?.mimeType).toBe('application/pdf');
        expect(raw?.blob).toBeDefined();
    });

    it('keeps imports of different materials independent', async () => {
        await repo.put(seedImported('mat-1', 'lecture.pdf'));
        await repo.put(seedImported('mat-2', 'handout.pdf'));

        expect((await db.localAssets.get('mat-1'))?.filename).toBe('lecture.pdf');
        expect((await db.localAssets.get('mat-2'))?.filename).toBe('handout.pdf');
        expect(await db.localAssets.count()).toBe(2);
    });

    it('does not disturb package-imported figures already stored for the material', async () => {
        await db.localAssets.put({
            assetId: 'asset-figure-1',
            materialId: 'mat-1',
            blob: new Blob(['PNG BYTES'], { type: 'image/png' }),
            mimeType: 'image/png',
            filename: 'figure41a.png',
            importedAt: '2026-09-02T00:00:00.000Z',
        });

        await repo.put(seedImported('mat-1', 'lecture.pdf'));

        expect(await db.localAssets.where('materialId').equals('mat-1').toArray()).toHaveLength(2);
    });
});
