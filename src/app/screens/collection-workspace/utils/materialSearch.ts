import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

/**
 * Case-insensitive title/tag match for the add-materials search.
 *
 * `term` is expected to already be lower-cased by the caller (the drawer
 * lower-cases once per render rather than per row). An empty term matches
 * everything.
 */
export function matchesSearch(material: StudyMaterial, term: string): boolean {
  if (!term) return true;
  return (
    material.title.toLowerCase().includes(term) ||
    material.tags?.some((tag) => tag.toLowerCase().includes(term)) === true
  );
}
