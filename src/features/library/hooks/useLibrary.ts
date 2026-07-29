import { useQuery } from '@tanstack/react-query';
import { libraryQueryKeys } from '../queries/libraryQueryKeys';
import { useLibraryRepository } from './useLibraryRepository';

/**
 * Pure query hook for fetching the study materials list.
 * Does **not** include mutation functions — use dedicated mutation hooks
 * (useCreateMaterial, useDeleteMaterial, useEditMaterial, useTouchMaterial)
 * for all data mutations.
 */
export function useLibrary() {
  const { libraryRepository } = useLibraryRepository();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: libraryQueryKeys.materials(),
    queryFn: ({ signal }) => libraryRepository.getMaterials(signal),
  });

  return {
    materials: data ?? [],
    isLoading,
    isError,
    error,
  };
}
