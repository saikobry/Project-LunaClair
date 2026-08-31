import { useQuery } from '@tanstack/react-query';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useContextOrThrow } from '../../../../../shared/utils/contextGuard';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';

/**
 * Query hook resolving ONE material from the **remote** catalog via the
 * authoritative per-id endpoint (`GET /api/catalog/materials/:id`, uncached).
 * Used by the read-only preview surface (`/available/:materialId/preview`),
 * which must never depend on the full catalog snapshot being in memory.
 *
 * Returns the full `MaterialResolution` (material + subject + term +
 * subjectTerm relationships) — the same resolution import uses.
 */
export function useAvailableMaterial(materialId: string | undefined) {
  const context = useContextOrThrow(ApplicationContext, 'useAvailableMaterial');

  return useQuery({
    queryKey: catalogQueryKeys.availableMaterial(materialId ?? ''),
    queryFn: ({ signal }) => context.infrastructure.repositories.catalog.getMaterial(materialId!, signal),
    enabled: !!materialId,
  });
}
