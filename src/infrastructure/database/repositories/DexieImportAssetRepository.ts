import type { ImportedAsset, ImportAssetRepository } from '../../../domain/importer/repositories/ImportAssetRepository';
import { db } from '../schema/LunaClairDatabase';

/**
 * Dexie-backed `ImportAssetRepository` — local storage for imported raw assets
 * like PDFs and images.
 *
 * This port stays deliberately single-asset-per-material: an import owns exactly one original
 * file, so on this write path `materialId` IS the asset identity. Rows land in the shared
 * `localAssets` store as `assetId = materialId`, and reads go through the `materialId` index —
 * a shape that tolerates multi-asset materials written by study package import, which is why
 * `get` takes the material's first row and `delete` clears every row of the material rather
 * than one key.
 */
export class DexieImportAssetRepository implements ImportAssetRepository {
    async get(materialId: string): Promise<ImportedAsset | undefined> {
        const stored = await db.localAssets.where('materialId').equals(materialId).first();
        if (!stored) return undefined;

        return {
            materialId: stored.materialId,
            blob: stored.blob,
            mimeType: stored.mimeType,
            filename: stored.filename,
            importedAt: stored.importedAt,
        };
    }

    async put(record: ImportedAsset): Promise<void> {
        await db.localAssets.put({
            assetId: record.materialId,
            materialId: record.materialId,
            blob: record.blob,
            mimeType: record.mimeType,
            filename: record.filename,
            importedAt: record.importedAt,
        });
    }

    async delete(materialId: string): Promise<void> {
        await db.localAssets.where('materialId').equals(materialId).delete();
    }
}

/** Singleton instance shared across the application composition root. */
export const dexieImportAssetRepository = new DexieImportAssetRepository();
