import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../shared/utils/contextGuard';
import { serializePackageToBlob } from '../../../domain/package/engines/StudyPackageSerializer';

/**
 * Serialized `.lcpack` byte budget for a material, mirroring the worker's
 * `MAX_SHARE_PAYLOAD_BYTES` (5 MiB) share guard. Kept beside the worker
 * constant by convention (client cannot import `worker/`) — update both
 * together.
 */
export const SHARE_PACKAGE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;

/**
 * Measures what this material would cost as a published share, without
 * downloading anything: materializes the study package and reads the
 * serialized blob size, then discards it.
 *
 * Local-only and offline-safe (IndexedDB reads + pure serialization). The
 * query is intentionally *not* invalidated on content edits — re-measure on
 * mount is enough for a budget indicator, and every edit invalidating a
 * full materialization would make typing expensive.
 */
export function useStudyPackageSize(materialId: string) {
  const context = useContextOrThrow(ApplicationContext, 'useStudyPackageSize');

  const { data: sizeBytes, isLoading } = useQuery({
    queryKey: ['package', 'size', materialId],
    queryFn: async () => {
      const pkg = await context.useCases.package.materializeStudyPackage.execute({
        materialId,
      });
      return serializePackageToBlob(pkg, true).size;
    },
    staleTime: Infinity,
  });

  return {
    sizeBytes,
    isLoading,
  };
}
