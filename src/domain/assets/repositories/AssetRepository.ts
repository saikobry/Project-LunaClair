/**
 * Canonical locally stored binary asset.
 *
 * `assetId` is the identity a document reference (`lc-asset://{assetId}`) resolves against —
 * exactly one blob per id. `materialId` is only the grouping index ("every asset belonging to
 * this material") and never identifies an individual asset. Confusing the two is the failure
 * mode this contract exists to prevent.
 */
export interface StoredAsset {
  assetId: string;
  materialId: string;
  blob: Blob;
  mimeType: string;
  filename: string;
  importedAt: string;
}

/**
 * Repository port for locally stored assets.
 *
 * Read-only **by contract, not by name**: `*Repository` is this codebase's suffix for a
 * persistence port (mirrored by `Dexie*Repository` adapters), so the read-only intent is carried
 * by the two-method surface and this note rather than by an invented `*Reader` suffix that no
 * other port uses.
 *
 * Asset writes belong to the persistence paths that own them — study package import, and the
 * importer's own single-file `ImportAssetRepository` — so this port never becomes a second write
 * boundary, and it stays source-agnostic: it knows how to retrieve an asset, never why it was
 * imported (no `.lcpack`, remapping, or import-session concepts belong here).
 */
export interface AssetRepository {
  /** Resolve one asset by the identity its document reference carries. */
  get(assetId: string): Promise<StoredAsset | undefined>;
  /** Every asset grouped under one material — one read for building a resolution map. */
  getByMaterialId(materialId: string): Promise<StoredAsset[]>;
}
