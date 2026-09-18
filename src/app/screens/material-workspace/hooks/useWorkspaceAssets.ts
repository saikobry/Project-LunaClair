import { useQuery } from '@tanstack/react-query';
import { readerQueryKeys } from '../../../../features/reader/queries/readerQueryKeys';
import { useAssetRepository } from '../../../../features/reader/hooks/useAssetRepository';

/**
 * Workspace-owned read of a material's stored binary assets (the import
 * original plus any package figures).
 *
 * Shares the reader's `readerQueryKeys.assets(materialId)` cache key, so the
 * sidebar/dialog reads below never trigger a second Dexie fetch beside the
 * reader's own figure resolution — one indexed read serves both.
 */
export function useWorkspaceAssets(materialId: string) {
  const assetRepository = useAssetRepository();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: readerQueryKeys.assets(materialId),
    queryFn: () => assetRepository.getByMaterialId(materialId),
  });

  return {
    assets,
    isLoading,
  };
}
