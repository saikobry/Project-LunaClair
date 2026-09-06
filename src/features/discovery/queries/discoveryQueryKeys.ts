/**
 * Discovery query keys — owns the remote catalog snapshot cache namespace (`['catalog', ...]`).
 */
export const discoveryQueryKeys = {
  all: ['catalog'] as const,
  catalog: () => ['catalog', 'remote'] as const,
};
