import { useQuery } from '@tanstack/react-query';
import { libraryQueryKeys } from '../../features/library/queries/libraryQueryKeys';
import { ApplicationContext } from '../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../utils/contextGuard';

/**
 * Pure query hook for fetching the study materials list.
 * Does **not** include mutation functions — use dedicated mutation hooks
 * (useCreateMaterial, useDeleteMaterial, useEditMaterial, useTouchMaterial)
 * for all data mutations.
 *
 * Shared so multiple features (library, subject, quiz) can consume the
 * materials list without cross-feature imports.
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
