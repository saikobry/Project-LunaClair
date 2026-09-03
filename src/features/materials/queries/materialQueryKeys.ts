/**
 * Material query keys — owns the local study materials cache namespace (`['library', ...]`).
 */
export const materialQueryKeys = {
  all: ['library', 'materials'] as const,
  materials: () => ['library', 'materials'] as const,
  material: (id: string) => ['library', 'material', id] as const,
};
