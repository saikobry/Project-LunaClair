import { useQuery } from '@tanstack/react-query';
import { libraryQueryKeys } from '../../queries/libraryQueryKeys';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Pure query hook for fetching the study materials list.
 * Does **not** include mutation functions — use dedicated mutation hooks
 * (useCreateMaterial, useDeleteMaterial, useEditMaterial, useTouchMaterial)
 * for all data mutations.
 *
 * Library-owned so other features consume the material capability through
 * the library public contract.
 */
export function useLibrary() {
  const context = useContextOrThrow(ApplicationContext, 'useLibrary');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: libraryQueryKeys.materials(),
    queryFn: ({ signal }) => context.libraryRepository.getMaterials(signal),
  });

  return {
    materials: data ?? [],
    isLoading,
    isError,
    error,
  };
}
