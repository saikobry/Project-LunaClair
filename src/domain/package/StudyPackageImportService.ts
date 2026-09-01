import type { StudyMaterial } from '../library/StudyMaterial';
import type { Question } from '../quiz/Question';
import type { Quiz } from '../quiz/Quiz';
import type { ImportedDocumentContent } from '../reader/DocumentContentRepository';

export interface ImportStudyPackageAsset {
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
