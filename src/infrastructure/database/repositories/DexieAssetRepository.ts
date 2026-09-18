import type { AssetRepository, StoredAsset } from '../../../domain/assets/repositories/AssetRepository';
import { db } from '../schema/LunaClairDatabase';

/**
 * Dexie-backed `AssetRepository` — resolves locally stored binary assets by their asset identity
 * (`assetId`) or grouped by material (`materialId`).
 */
export class DexieAssetRepository implements AssetRepository {
    async get(assetId: string): Promise<StoredAsset | undefined> {
        return await db.localAssets.get(assetId);
    }

    async getByMaterialId(materialId: string): Promise<StoredAsset[]> {
        return await db.localAssets.where('materialId').equals(materialId).toArray();
    }
}

/** Singleton instance shared across the application composition root. */
export const dexieAssetRepository = new DexieAssetRepository();
