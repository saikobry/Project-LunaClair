import { useState, useMemo } from 'react';
import { useLibrary } from '../../materials/hooks/queries/useLibrary';
import { usePublicShares } from './usePublicShares';
import type { ExploreContentItem, ExploreSortOption } from '../explore.types';

export interface UseExploreContentOptions {
  initialSort?: ExploreSortOption;
}

/**
 * Shares-only Explore content hook.
 *
 * The Explore hub surfaces published `.lcpack` shares exclusively — the
 * official catalog snapshot is no longer a separate content source here.
 * Library membership is derived from exact clone identity (`originShareId`
 * recorded on materials at clone time), never title matching.
 */
export function useExploreContent(options: UseExploreContentOptions = {}) {
  const [sort, setSort] = useState<ExploreSortOption>(options.initialSort ?? 'popular');
  const [search, setSearch] = useState('');

  const { materials: localMaterials } = useLibrary();
  const { data: publicSharesData, isLoading: isSharesLoading, isError: isSharesError } = usePublicShares({
    q: search.trim() || undefined,
    sort,
  });

  const localOriginSet = useMemo(
    () =>
      new Set(
        localMaterials.flatMap((m) => (m.originShareId ? [m.originShareId] : [])),
      ),
    [localMaterials],
  );

  const items = useMemo<ExploreContentItem[]>(
    () =>
      (publicSharesData?.items ?? []).map((share) => ({
        id: share.id,
        title: share.title,
        description: share.description,
        author: share.author,
        viewCount: share.viewCount,
        downloadCount: share.downloadCount,
        createdAt: share.createdAt,
        isVerified: Boolean((share as { isVerified?: unknown }).isVerified),
        isInLibrary: localOriginSet.has(share.id),
      })),
    [publicSharesData, localOriginSet],
  );

  return {
    items,
    isLoading: isSharesLoading,
    isError: isSharesError,
    sort,
    setSort,
    search,
    setSearch,
  };
}
