import type { ImportedAsset, ImportAssetRepository } from '../../../domain/importer/repositories/ImportAssetRepository';
import { db } from '../schema/LunaClairDatabase';

/**
 * Dexie-backed `ImportAssetRepository` — writes the original file of a PDF/image import.
 *
 * Deliberately single-asset-per-material: an import owns exactly one original file, so on this
 * write path `materialId` IS the asset identity. The row lands in the shared `localAssets`
 * store as `assetId = materialId`, alongside any package-imported figures of the same material
 * (which are keyed by their own asset ids and grouped by the `materialId` index).
 *
 * Write-only by contract: reads go through `AssetRepository` (`domain/assets`), and asset
 * removal happens inside `DexieLibraryImportService.removeMaterial`'s transaction so it
 * commits atomically with the material delete.
 */
export class DexieImportAssetRepository implements ImportAssetRepository {
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
}

/** Singleton instance shared across the application composition root. */
export const dexieImportAssetRepository = new DexieImportAssetRepository();
