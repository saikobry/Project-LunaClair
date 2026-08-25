export interface ImportedAsset {
  materialId: string;
  blob: Blob;
  mimeType: string;
  filename: string;
  importedAt: string;
}

export interface ImportAssetRepository {
  put(asset: ImportedAsset): Promise<void>;
  get(materialId: string): Promise<ImportedAsset | undefined>;
  delete(materialId: string): Promise<void>;
}
