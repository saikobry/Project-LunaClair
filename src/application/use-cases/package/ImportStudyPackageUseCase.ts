import type { LocalIdGenerator, StudyPackage } from '../../../domain/package/models/package.types';
import { validateStudyPackage } from '../../../domain/package/engines/validateStudyPackage';
import { remapStudyPackage } from '../../../domain/package/engines/remapStudyPackage';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { ImportedDocumentContent } from '../../../domain/reader/repositories/DocumentContentRepository';
import type {
  StudyPackageImportService,
  ImportStudyPackageAsset,
} from '../../../domain/package/services/StudyPackageImportService';

export interface ImportStudyPackageInput {
  package: StudyPackage | unknown;
  /** Cloud share ID this package was cloned from (records exact clone identity on materials). */
  originShareId?: string;
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
 * Use case to validate, remap, and atomically import a StudyPackage into local storage.
 *
 * Invariants:
 * - Pre-validation: Input must pass all schema and relational checks before storage is touched.
 * - Collision-Free: Every import generates a fresh, collision-free local UUID identity mapping.
 * - Atomic Transaction: All materials, document contents, questions, quizzes, and assets commit in a single transaction via StudyPackageImportService.
 * - Failure Isolation: If validation or transaction fails, local library remains 100% untouched.
 */
export class ImportStudyPackageUseCase {
  private readonly importService: StudyPackageImportService;

  constructor(importService: StudyPackageImportService) {
    this.importService = importService;
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

    // 3. Prepare records
    const materialRecords: StudyMaterial[] = remapped.materials.map((mat) => ({
      id: mat.id,
      title: mat.title,
      description: mat.description,
      documentId: mat.documentId,
      order: mat.order ?? 0,
      createdAt: now,
      updatedAt: now,
      originShareId: input.originShareId,
      tags: mat.tags,
    }));

    const documentContentRecords: ImportedDocumentContent[] = remapped.materials.map((mat) => ({
      documentId: mat.documentId,
      title: mat.title,
      content: mat.documentContent,
      updatedAt: now,
    }));

    const assetRecords: ImportStudyPackageAsset[] = remapped.assets.map((asset) => ({
      // `asset.id` is the remapped local UUID the documentContent URIs were already rewritten
      // to (remapStudyPackage step 2), so it is the asset's identity — never materialId.
      assetId: asset.id,
      materialId: asset.materialId || (remapped.materials[0]?.id ?? ''),
      filename: asset.filename,
      mimeType: asset.mimeType,
      dataBase64: asset.dataBase64,
      importedAt: now,
    }));

    // 4. Delegate atomic multi-entity transaction to domain port
    await this.importService.importStudyPackage({
      materials: materialRecords,
      documentContents: documentContentRecords,
      questions: remapped.questions,
      quizzes: remapped.quizzes,
      assets: assetRecords,
    });

    return {
      materialIds: materialRecords.map((m) => m.id),
      questionIds: remapped.questions.map((q) => q.id),
      quizIds: remapped.quizzes.map((q) => q.id),
      assetIds: remapped.assets.map((a) => a.id),
      idMap: remapped.idMap,
    };
  }
}
