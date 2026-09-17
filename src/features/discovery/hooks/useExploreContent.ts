import { useMemo } from 'react';
import { useLocalOriginMaterials } from './useLocalOriginMaterials';
import { usePublicShares } from './usePublicShares';
import {
  EXPLORE_PAGE_LIMIT,
  type ExploreContentItem,
  type ExploreSortOption,
} from '../explore.types';

export const DEFAULT_EXPLORE_SORT: ExploreSortOption = 'popular';

export interface UseExploreContentParams {
  /** Committed search query — URL state, already debounced by the caller. */
  q?: string;
  sort?: ExploreSortOption;
}

/**
 * Shares-only Explore content hook.
 *
 * The Explore hub surfaces published `.lcpack` shares exclusively — the
 * official catalog snapshot is no longer a separate content source here.
 * Library membership is derived from exact clone identity (`originShareId`
 * recorded on materials at clone time), never title matching.
 *
 * Deliberately stateless: `q`/`sort` arrive as params because they are URL
 * state (`/explore?q=&sort=`), so this hook only queries and maps.
 */
export function useExploreContent({ q, sort }: UseExploreContentParams = {}) {
  const effectiveSort = sort ?? DEFAULT_EXPLORE_SORT;

  const { data: publicSharesData, isLoading: isSharesLoading, isError: isSharesError, refetch } =
    usePublicShares({
      q: q?.trim() || undefined,
      sort: effectiveSort,
      limit: EXPLORE_PAGE_LIMIT,
    });

  /** Exact clone identity: membership plus the card's "Open in library" target. */
  const localMaterialByOrigin = useLocalOriginMaterials();

  const items = useMemo<ExploreContentItem[]>(
    () =>
      (publicSharesData?.items ?? []).map((share) => {
        const libraryMaterialId = localMaterialByOrigin.get(share.id);
        return {
          id: share.id,
          title: share.title,
          description: share.description,
          author: share.author,
          viewCount: share.viewCount,
          downloadCount: share.downloadCount,
          createdAt: share.createdAt,
          isVerified: Boolean((share as { isVerified?: unknown }).isVerified),
          isInLibrary: libraryMaterialId !== undefined,
          libraryMaterialId,
        };
      }),
    [publicSharesData, localMaterialByOrigin],
  );

  return {
    items,
    isLoading: isSharesLoading,
    isError: isSharesError,
    sort: effectiveSort,
    refetch,
  };
}
