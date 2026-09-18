import type { StudyMaterial } from '../models/StudyMaterial';

export interface CreateMaterialInput {
  title: string;
  description?: string;
  documentId?: string;
  order?: number;
  tags?: string[];
}

export interface UpdateMaterialInput {
  title?: string;
  description?: string;
  lastOpenedAt?: string;
  /** Tags are normalized at the write boundary; an empty array clears tags, undefined leaves them unchanged. */
  tags?: string[];
}

/**
 * Local library persistence for study materials.
 *
 * Deliberately has **no delete method**. Material removal is the atomic cascade on
 * `LibraryImportService.removeMaterial`, which clears the material row together with its
 * questions, quizzes, document content, collection membership, and stored binary assets in one
 * transaction. A row-only delete here would let a caller silently strand every one of those, and
 * material dependencies can be acquired after creation (a material created empty can later gain
 * questions, an imported file, or collection membership), so a "cheap" partial delete is never safe.
 */
export interface LibraryRepository {
  getMaterials(signal?: AbortSignal): Promise<StudyMaterial[]>;
  getMaterialById(id: string, signal?: AbortSignal): Promise<StudyMaterial | null>;
  createMaterial(input: CreateMaterialInput): Promise<StudyMaterial>;
  updateMaterial(id: string, input: UpdateMaterialInput): Promise<StudyMaterial>;
}
