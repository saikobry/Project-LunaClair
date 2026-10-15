import type { AssetRepository, StoredAsset } from '../../../domain/assets/repositories/AssetRepository';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../schema/LunaClairDatabase';

/**
 * Dexie-backed `AssetRepository` — resolves locally stored binary assets by their asset identity
 * (`assetId`) or grouped by material (`materialId`).
 */
export class DexieAssetRepository implements AssetRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = getActiveVaultDatabase()) {
        this.db = database;
    }

    async get(assetId: string): Promise<StoredAsset | undefined> {
        return await this.db.localAssets.get(assetId);
    }

    async getByMaterialId(materialId: string): Promise<StoredAsset[]> {
        return await this.db.localAssets.where('materialId').equals(materialId).toArray();
    }
}

/** Singleton instance shared across the application composition root. */
export const dexieAssetRepository = new DexieAssetRepository();
