export const STORAGE_KEYS = {
  library: {
    materials: 'lunaclair.library.materials',
  },
  reader: {
    highlights: 'lunaclair.reader.highlights',
    drawings: 'lunaclair.reader.drawings',
  },
  settings: {
    theme: 'lunaclair.settings.theme',
  },
} as const;

/**
 * Legacy storage keys from pre-Phase 3 builds.
 * Used by repository migration logic to relocate existing user data.
 */
// TODO(v1.0): Remove legacy migration after stable release.
export const LEGACY_STORAGE_KEYS = {
  libraryMaterials: 'library-materials',
  highlights: 'reviewer-highlights',
  paths: 'reviewer-paths',
} as const;
