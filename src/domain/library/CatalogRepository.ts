import type { StudyMaterial } from './StudyMaterial';
import type { Subject } from './Subject';
import type { Term } from './Term';
import type { SubjectTerm } from './SubjectTerm';

/**
 * Remote catalog snapshot delivered by `GET /api/catalog`.
 *
 * This is **server state** — what the platform makes available. It is never
 * copied wholesale into Dexie; the user explicitly imports the materials they
 * want in their local library (Dexie = local selection/working state).
 */
export interface CatalogSnapshot {
  subjects: Subject[];
  terms: Term[];
  subjectTerms: SubjectTerm[];
  materials: StudyMaterial[];
}

/**
 * Application-facing repository for the remote (D1-backed) catalog.
 * Reads only — import/removal mutations go through `ImportMaterialUseCase` /
 * `RemoveImportedMaterialUseCase`.
 */
export interface CatalogRepository {
  getCatalog(signal?: AbortSignal): Promise<CatalogSnapshot>;
}
