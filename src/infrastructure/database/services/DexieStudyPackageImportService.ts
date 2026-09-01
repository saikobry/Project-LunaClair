import type {
  StudyPackageImportService,
  ImportStudyPackageRecords,
} from '../../../domain/package/StudyPackageImportService';
import { base64ToBlob } from '../../../domain/package/StudyPackageSerializer';
import { db as defaultDb, type LunaClairDatabase, type ImportAssetRecord } from '../LunaClairDatabase';

/**
 * Dexie implementation of `StudyPackageImportService`.
 *
 * Coordinates atomic multi-table commit across `materials`, `documentContents`,
 * `questions`, `quizzes`, and `importAssets` inside a single Dexie transaction.
 */
export class DexieStudyPackageImportService implements StudyPackageImportService {
  private readonly db: LunaClairDatabase;

  constructor(db: LunaClairDatabase = defaultDb) {
    this.db = db;
  }

  async importStudyPackage(records: ImportStudyPackageRecords): Promise<void> {
    const assetRecords: ImportAssetRecord[] = records.assets.map((asset) => ({
      materialId: asset.materialId,
      blob: base64ToBlob(asset.dataBase64, asset.mimeType),
      mimeType: asset.mimeType,
      filename: asset.filename,
      importedAt: asset.importedAt,
    }));

    await this.db.transaction(
      'rw',
      [
        this.db.materials,
        this.db.documentContents,
        this.db.questions,
        this.db.quizzes,
        this.db.importAssets,
      ],
      async () => {
        if (records.materials.length > 0) {
          await this.db.materials.bulkPut(records.materials);
        }
        if (records.documentContents.length > 0) {
          await this.db.documentContents.bulkPut(records.documentContents);
        }
        if (records.questions.length > 0) {
          await this.db.questions.bulkPut(records.questions);
        }
        if (records.quizzes.length > 0) {
          await this.db.quizzes.bulkPut(records.quizzes);
        }
        if (assetRecords.length > 0) {
          await this.db.importAssets.bulkPut(assetRecords);
        }
      },
    );
  }
}
