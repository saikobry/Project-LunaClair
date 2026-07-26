import type { LibraryRepository } from '../domain/library/LibraryRepository';

/**
 * Initializes the application: seeds demo data if the library is empty.
 * Accepts a `LibraryRepository` instance to remain backend-agnostic.
 */
export async function bootstrapApplication(repository: LibraryRepository): Promise<void> {
  // Seed demo material if library is empty
  const materials = await repository.getMaterials();
  if (materials.length === 0) {
    await repository.createMaterial({
      title: 'Anatomy & Physiology: Body Membranes',
      description:
        'Covering the integumentary system, skin structure, membranes, and common pathologies.',
      sourceType: 'bundled',
      sourceId: 'anatomy-physiology',
    });
  }
}
