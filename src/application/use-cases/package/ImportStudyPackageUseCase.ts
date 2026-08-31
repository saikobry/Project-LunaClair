import type { LunaClairDatabase } from '../../../infrastructure/database/LunaClairDatabase';
import type { LocalIdGenerator, StudyPackage } from '../../../domain/package/package.types';
import { validateStudyPackage } from '../../../domain/package/validateStudyPackage';
import { remapStudyPackage } from '../../../domain/package/remapStudyPackage';
import { base64ToBlob } from '../../../domain/package/StudyPackageSerializer';
import type { StudyMaterial } from '../../../domain/library/StudyMaterial';
import type { ImportedDocumentContent } from '../../../domain/reader/DocumentContentRepository';
import type { ImportAssetRecord } from '../../../infrastructure/database/LunaClairDatabase';

export interface ImportStudyPackageInput {
  package: StudyPackage | unknown;
  targetSubjectId?: string;
  targetTermId?: string;
  idGenerator?: LocalIdGenerator;
}

export interface ImportStudyPackageResult {
  materialIds: string[];
  questionIds: string[];
  quizIds: string[];
  assetIds: string[];
  idMap: Map<string, string>;
}

/**
 * Use case to validate, remap, and atomically import a StudyPackage into local Dexie storage.
 *
 * Invariants:
 * - Pre-validation: Input must pass all schema and relational checks before storage is touched.
 * - Collision-Free: Every import generates a fresh, collision-free local UUID identity mapping.
 * - Atomic Transaction: All materials, document contents, questions, quizzes, and assets commit in a single Dexie transaction.
 * - Failure Isolation: If validation or transaction fails, local library remains 100% untouched.
 */
export class ImportStudyPackageUseCase {
  private readonly db: LunaClairDatabase;

  constructor(db: LunaClairDatabase) {
    this.db = db;
  }

  async execute(input: ImportStudyPackageInput): Promise<ImportStudyPackageResult> {
    // 1. Validate package structure and relational graph integrity
    const validation = validateStudyPackage(input.package);
    if (!validation.isValid) {
      throw new Error(`StudyPackage validation failed:\n- ${validation.errors.join('\n- ')}`);
    }

    const validPackage = input.package as StudyPackage;

    // 2. Remap package-scoped IDs to fresh local UUIDs in memory
    const remapped = remapStudyPackage(validPackage, input.idGenerator);
    const now = new Date().toISOString();

    // 3. Prepare Dexie records
    const materialRecords: StudyMaterial[] = remapped.materials.map((mat) => ({
      id: mat.id,
      title: mat.title,
      description: mat.description,
      documentId: mat.documentId,
      subjectId: input.targetSubjectId || undefined,
      termId: input.targetTermId || undefined,
      order: mat.order ?? 0,
      createdAt: now,
      updatedAt: now,
    }));

    const documentContentRecords: ImportedDocumentContent[] = remapped.materials.map((mat) => ({
      documentId: mat.documentId,
      title: mat.title,
      content: mat.documentContent,
      updatedAt: now,
    }));

    const assetRecords: ImportAssetRecord[] = remapped.assets.map((asset) => ({
      materialId: asset.materialId || (remapped.materials[0]?.id ?? ''),
      blob: base64ToBlob(asset.dataBase64, asset.mimeType),
      mimeType: asset.mimeType,
      filename: asset.filename,
      importedAt: now,
    }));

    // 4. Atomic Dexie transaction across all canonical tables
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
        if (materialRecords.length > 0) {
          await this.db.materials.bulkPut(materialRecords);
        }
        if (documentContentRecords.length > 0) {
          await this.db.documentContents.bulkPut(documentContentRecords);
        }
        if (remapped.questions.length > 0) {
          await this.db.questions.bulkPut(remapped.questions);
        }
        if (remapped.quizzes.length > 0) {
          await this.db.quizzes.bulkPut(remapped.quizzes);
        }
        if (assetRecords.length > 0) {
          await this.db.importAssets.bulkPut(assetRecords);
        }
      },
    );

    return {
      materialIds: materialRecords.map((m) => m.id),
      questionIds: remapped.questions.map((q) => q.id),
      quizIds: remapped.quizzes.map((q) => q.id),
      assetIds: remapped.assets.map((a) => a.id),
      idMap: remapped.idMap,
    };
  }
}
