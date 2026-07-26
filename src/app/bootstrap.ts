import type { LibraryRepository } from '../domain/library/LibraryRepository';
import rawMarkdown from '../features/reader/assets/content.md?raw';
import { registerContent } from '../services/content/LocalDocumentRepository';

const DEMO_SOURCE_ID = 'anatomy-physiology-body-membranes';

/**
 * Initializes the application: registers content sources and seeds demo data.
 * Accepts a `LibraryRepository` instance to remain backend-agnostic.
 */
export async function bootstrapApplication(repository: LibraryRepository): Promise<void> {
  // Register the demo document content
  registerContent(DEMO_SOURCE_ID, rawMarkdown);

  // Seed demo material if library is empty
  const materials = await repository.getMaterials();
  if (materials.length === 0) {
    await repository.createMaterial({
      title: 'Anatomy & Physiology: Body Membranes',
      description:
        'Covering the integumentary system, skin structure, membranes, and common pathologies.',
    });
  }
}
