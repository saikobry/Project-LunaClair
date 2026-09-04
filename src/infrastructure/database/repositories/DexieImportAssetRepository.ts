import type { ImportedAsset, ImportAssetRepository } from '../../../domain/importer/repositories/ImportAssetRepository';
import { db } from '../schema/LunaClairDatabase';

/**
 * Dexie-backed `ImportAssetRepository` — local storage for imported raw assets
 * like PDFs and images.
 */
export class DexieImportAssetRepository implements ImportAssetRepository {
    async get(materialId: string): Promise<ImportedAsset | undefined> {
        return await db.importAssets.get(materialId);
    }

    async put(record: ImportedAsset): Promise<void> {
        await db.importAssets.put(record);
    }

    async delete(materialId: string): Promise<void> {
        await db.importAssets.delete(materialId);
    }
}

/** Singleton instance shared across the application composition root. */
export const dexieImportAssetRepository = new DexieImportAssetRepository();
