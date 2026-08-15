/**
 * Catalog query key factory — single owner for material, subject, and term
 * cache namespaces. Key arrays are preserved from the former
 * `libraryQueryKeys` (`['library', ...]`) and `subjectQueryKeys`
 * (`['subject', ...]`) factories to keep cache identity stable across the
 * consolidation refactor.
 */
export const catalogQueryKeys = {
  root: ['catalog'] as const,
  // Remote catalog snapshot (GET /api/catalog) — server state, not local library
  catalog: () => ['catalog', 'remote'] as const,
  // Authoritative per-material remote resolution (GET /api/catalog/materials/:id)
  // — used by import and the read-only preview surface; deliberately uncached
  // on the server, so this key always reflects current server state
  availableMaterial: (id: string) => ['catalog', 'remote', 'material', id] as const,
  // Material cache namespace (formerly libraryQueryKeys)
  materials: () => ['library', 'materials'] as const,
  material: (id: string) => ['library', 'material', id] as const,
  // Subject & term cache namespace (formerly subjectQueryKeys)
  subjects: () => ['subject', 'subjects'] as const,
  subject: (id: string) => ['subject', 'subject', id] as const,
  terms: () => ['subject', 'terms'] as const,
  termsBySubject: (subjectId: string) =>
    ['subject', 'terms', subjectId] as const,
  term: (id: string) => ['subject', 'term', id] as const,
  termUsageCounts: () => ['subject', 'terms', 'usageCounts'] as const,
  subjectTermUsage: (subjectId: string) =>
    ['subject', 'terms', subjectId, 'subjectUsage'] as const,
};
