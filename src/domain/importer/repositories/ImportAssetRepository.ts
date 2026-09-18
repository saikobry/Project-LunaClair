/**
 * The original binary file an import owns — a PDF or image, exactly one per material.
 *
 * `materialId` is the identity on this path (an import owns one file), which is why
 * `DexieImportAssetRepository` writes the row into the shared `localAssets` store as
 * `assetId = materialId`.
 */
export interface ImportedAsset {
  materialId: string;
  blob: Blob;
  mimeType: string;
  filename: string;
  importedAt: string;
}

/**
 * Write-only port for preserving an import's original binary file.
 *
 * Reads are deliberately absent: multi-asset material reads belong to the generic
 * `AssetRepository` port (`domain/assets`), and asset removal inside a material's delete
 * transaction belongs to `DexieLibraryImportService.removeMaterial`, which needs it
 * to commit atomically with the rest of the removal. Keeping writes here means this port can
 * never become a second, divergent read or delete path over the same store.
 */
export interface ImportAssetRepository {
  put(asset: ImportedAsset): Promise<void>;
}
