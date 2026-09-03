/**
 * Discovery query keys — owns the remote catalog snapshot and available preview cache namespace (`['catalog', ...]`).
 */
export const discoveryQueryKeys = {
  all: ['catalog'] as const,
  catalog: () => ['catalog', 'remote'] as const,
  availableMaterial: (id: string) => ['catalog', 'remote', 'material', id] as const,
};
