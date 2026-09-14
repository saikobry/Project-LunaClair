/**
 * Collection query keys — owns the collections cache namespace (`['collections', ...]`).
 */
export const collectionQueryKeys = {
  all: ['collections'] as const,
  lists: () => [...collectionQueryKeys.all, 'list'] as const,
  details: () => [...collectionQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...collectionQueryKeys.details(), id] as const,
  materials: (collectionId: string) => [...collectionQueryKeys.all, 'materials', collectionId] as const,
  materialCollections: (materialId: string) => [...collectionQueryKeys.all, 'material-collections', materialId] as const,
  /** Material ids that belong to at least one collection (drives the Library uncollected lens). */
  assignedMaterialIds: () => [...collectionQueryKeys.all, 'assigned-material-ids'] as const,
  materialCounts: () => [...collectionQueryKeys.all, 'material-counts'] as const,
};
