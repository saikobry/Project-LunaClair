import type { StudyMaterial } from '../../library/models/StudyMaterial';
import type { Question } from '../../quiz/models/Question';
import type { Quiz } from '../../quiz/models/Quiz';
import type { ImportedDocumentContent } from '../../reader/repositories/DocumentContentRepository';

export interface ImportStudyPackageAsset {
  /** Remapped local asset identity — the value `lc-asset://{assetId}` in documentContent points at. */
  assetId: string;
  /** Grouping index: the material this asset belongs to. */
  materialId: string;
  filename: string;
  mimeType: string;
  dataBase64: string;
  importedAt: string;
}

export interface ImportStudyPackageRecords {
  materials: StudyMaterial[];
  documentContents: ImportedDocumentContent[];
  questions: Question[];
  quizzes: Quiz[];
  assets: ImportStudyPackageAsset[];
}

/**
 * Domain port for atomic study package persistence.
 *
 * Implementations live in the infrastructure layer (e.g. `DexieStudyPackageImportService`)
 * and coordinate atomic multi-table persistence across materials, document contents,
 * questions, quizzes, and assets.
 */
export interface StudyPackageImportService {
  importStudyPackage(records: ImportStudyPackageRecords): Promise<void>;
}
