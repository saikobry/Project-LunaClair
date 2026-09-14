import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { materialQueryKeys } from '../../queries/materialQueryKeys';
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
    queryKey: materialQueryKeys.materials(),
    queryFn: ({ signal }) => context.repositories.library.getMaterials(signal),
  });

  // Dexie returns primary-key (lexicographic id) order, so `seed-m-10`
  // would sort before `seed-m-2`. Re-apply the authored `order` here, in
  // memory (indexed `orderBy` would drop rows with no `order`; unordered
  // rows sort last, stably).
  const materials = useMemo(() => {
    if (!data) return [];
    return [...data].sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
    );
  }, [data]);

  return {
    materials,
    isLoading,
    isError,
    error,
  };
}
