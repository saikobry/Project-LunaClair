/**
 * Domain application service contract for the material removal workflow that
 * writes across multiple Dexie stores and must commit atomically (materials,
 * questions, quizzes, documentContents, localAssets, collectionMaterials,
 * flashcardReviews).
 *
 * `removeMaterial` is the **single removal contract** for a material.
 * `LibraryRepository` deliberately exposes no delete, so no caller can remove a
 * material row without its dependents.
 *
 * There is no import method on this port, and that is deliberate (Sep 2026).
 * The catalog-era single/batch material import use cases were removed in the
 * Phase 5 catalog retirement, leaving the adapter's `importMaterial` /
 * `importMaterialBatch` with no caller. They were the one *existing* ungated
 * write surface into `db.questions`: a method nothing can call still reads as a
 * supported write path, and it bypassed `validateQuestionPayload` that every
 * live ingress runs. A dead writer is a compatibility promise with no
 * population behind it, so it was deleted rather than gated. Library
 * population goes through the writers that do validate:
 * `StudyPackageImportService` for a cloned share or imported `.lcpack`, and the
 * importer use cases for a document.
 *
 * Implementations live in the infrastructure layer (e.g.
 * `DexieLibraryImportService`) and are supplied to feature hooks through the
 * `ApplicationContext` — domain and feature code never import Dexie directly.
 */
export interface LibraryImportService {
  /**
   * Removes one material from the local library, and everything that belongs to
   * it: the material row, its questions and quizzes, its locally imported
   * document content, its `collectionMaterials` junction rows, and its stored
   * binary assets (imported original file plus any package figures) — in one
   * transaction. Local-only: the published share stays on the server and can be
   * cloned again from Explore.
   */
  removeMaterial(materialId: string): Promise<void>;
}
