import rawMarkdown from '../features/reader/assets/content.md?raw';
import { libraryRepository } from '../services/storage/libraryRepository';
import { registerContent } from '../services/content/contentService';
import type { StudyMaterial } from '../domain/library';

const DEMO_SOURCE_ID = 'anatomy-physiology-body-membranes';

const demoMaterial: StudyMaterial = {
  id: 'demo-001',
  title: 'Anatomy & Physiology: Body Membranes',
  description: 'Covering the integumentary system, skin structure, membranes, and common pathologies.',
  sourceType: 'markdown',
  sourceId: DEMO_SOURCE_ID,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Initializes the application: registers content sources and seeds demo data.
 */
export function bootstrapApplication(): void {
  // Register the demo document content
  registerContent(DEMO_SOURCE_ID, rawMarkdown);

  // Seed demo material if library is empty
  libraryRepository.seedIfEmpty(demoMaterial);
}
