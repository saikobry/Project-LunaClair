export const libraryQueryKeys = {
  root: ['library'] as const,
  materials: () => [...libraryQueryKeys.root, 'materials'] as const,
  material: (id: string) => [...libraryQueryKeys.root, 'material', id] as const,
  subjects: () => [...libraryQueryKeys.root, 'subjects'] as const,
};
