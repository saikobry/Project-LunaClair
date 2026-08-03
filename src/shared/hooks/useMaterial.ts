import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../app/providers/ApplicationContext';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';

/**
 * Query hook for resolving a single StudyMaterial by ID.
 * Used by workspaces when passing only a materialId.
 */
export function useMaterial(materialId: string | undefined) {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useMaterial must be used within a <ApplicationProvider>');
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: libraryQueryKeys.material(materialId ?? ''),
    queryFn: ({ signal }) => context.libraryRepository.getMaterialById(materialId!, signal),
    enabled: !!materialId,
  });

  return { material: data ?? null, isLoading, isError, error };
}
