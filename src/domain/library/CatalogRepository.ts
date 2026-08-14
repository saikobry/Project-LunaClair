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
 * One material resolved from the canonical (D1) catalog together with the
 * relationships required to import it locally — returned by
 * `GET /api/catalog/materials/:id`. This is the **authoritative resolution**
 * used by import: import must never require the full `CatalogSnapshot` to be
 * present in memory (e.g. when the catalog is delivered paginated/lazy).
 */
export interface MaterialResolution {
  material: StudyMaterial;
  subject?: Subject;
  term?: Term;
  subjectTerm?: SubjectTerm;
}

/**
 * Application-facing repository for the remote (D1-backed) catalog.
 * Reads only — import/removal mutations go through `ImportMaterialUseCase` /
 * `RemoveImportedMaterialUseCase`.
 */
export interface CatalogRepository {
  getCatalog(signal?: AbortSignal): Promise<CatalogSnapshot>;
  /**
   * Resolve one material + its subject/term/subjectTerm relationships for
   * import. Throws when the material is not in the canonical catalog.
   */
  getMaterial(materialId: string, signal?: AbortSignal): Promise<MaterialResolution>;
}
