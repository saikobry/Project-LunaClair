import type { StudyMaterial } from '../models/StudyMaterial';
import type { Question } from '../../quiz/models/Question';
import type { Quiz } from '../../quiz/models/Quiz';
import type { ImportedDocumentContent } from '../../reader/repositories/DocumentContentRepository';

export interface ImportMaterialInput {
  material: StudyMaterial;
  questions: Question[];
  quizzes: Quiz[];
  documentContent?: ImportedDocumentContent;
}

/**
 * Domain application service contract for the material import/removal
 * workflows that write across multiple Dexie stores and must commit
 * atomically (materials, questions, quizzes, documentContents).
 *
 * Implementations live in the infrastructure layer (e.g.
 * `DexieLibraryImportService`) and are supplied to feature hooks through the
 * `ApplicationContext` — domain and feature code never import Dexie directly.
 */
export interface LibraryImportService {
  /**
   * Persists one imported material and everything that belongs to it:
   * the material row, its questions and quizzes (bulk put), and its
   * locally imported document content.
   */
  importMaterial(input: ImportMaterialInput): Promise<void>;

  /**
   * Persists multiple imported materials atomically in a single transaction:
   * bulk-inserts materials, questions, quizzes, and document contents.
   */
  importMaterialBatch(inputs: ImportMaterialInput[]): Promise<void>;

  /**
   * Removes one imported material from the local library: the material row,
   * its questions and quizzes, and its locally imported document content.
   * Canonical D1 catalog entries are untouched (this is local-only removal).
   */
  removeImportedMaterial(materialId: string): Promise<void>;
}
