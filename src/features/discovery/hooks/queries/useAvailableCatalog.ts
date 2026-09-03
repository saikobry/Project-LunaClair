import { useQuery } from '@tanstack/react-query';
import { discoveryQueryKeys } from '../../queries/discoveryQueryKeys';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';

/**
 * Query hook for the **remote** catalog (`GET /api/catalog`) — server state
 * surfaced as "Available Materials". Never copied wholesale into Dexie;
 * materials are imported on user action via `useImportMaterial`.
 *
 * Uses the existing catalog query-key namespace (`['library', ...]`), so
 * invalidating after an import/removal reconciles both the local library and
 * the available catalog in one cache sweep.
 */
export function useAvailableCatalog() {
  const context = useContextOrThrow(ApplicationContext, 'useAvailableCatalog');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: discoveryQueryKeys.catalog(),
    queryFn: ({ signal }) => context.repositories.catalog.getCatalog(signal),
  });

  return {
    catalog: data,
    isLoading,
    isError,
    error,
  };
}
