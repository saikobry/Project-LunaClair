import { useState, useMemo } from 'react';
import { useAvailableCatalog } from './queries/useAvailableCatalog';
import { useLibrary } from '../../materials/hooks/queries/useLibrary';
import { usePublicShares } from './usePublicShares';
import type { ExploreContentItem, ExploreSourceFilter, ExploreSortOption } from '../explore.types';

export interface UseExploreContentOptions {
  initialFilter?: ExploreSourceFilter;
  initialSort?: ExploreSortOption;
}

export function useExploreContent(options: UseExploreContentOptions = {}) {
  const [sourceFilter, setSourceFilter] = useState<ExploreSourceFilter>(options.initialFilter ?? 'all');
  const [sort, setSort] = useState<ExploreSortOption>(options.initialSort ?? 'popular');
  const [search, setSearch] = useState('');

  const { catalog, isLoading: isCatalogLoading, isError: isCatalogError } = useAvailableCatalog();
  const { materials: localMaterials } = useLibrary();
  const { data: publicSharesData, isLoading: isSharesLoading, isError: isSharesError } = usePublicShares({
    q: search.trim() || undefined,
    sort,
  });

  const localMaterialIds = useMemo(() => new Set(localMaterials.map((m) => m.id)), [localMaterials]);
  const localMaterialTitles = useMemo(
    () => new Set(localMaterials.map((m) => m.title.toLowerCase().trim())),
    [localMaterials],
  );

  const items = useMemo<ExploreContentItem[]>(() => {
    const list: ExploreContentItem[] = [];

    // 1. Official Catalog Items
    if (sourceFilter === 'all' || sourceFilter === 'official') {
      if (catalog?.materials) {
        const subjectsMap = new Map((catalog.subjects ?? []).map((s) => [s.id, s.title]));
        const termsMap = new Map((catalog.terms ?? []).map((t) => [t.id, t.title]));

        for (const mat of catalog.materials) {
          const subjectName = mat.subjectId ? subjectsMap.get(mat.subjectId) ?? 'General' : 'General';
          const termName = mat.termId ? termsMap.get(mat.termId) ?? '' : '';

          // Client-side search filtering on official catalog
          const qLower = search.trim().toLowerCase();
          if (
            !qLower ||
            mat.title.toLowerCase().includes(qLower) ||
            mat.description?.toLowerCase().includes(qLower) ||
            subjectName.toLowerCase().includes(qLower) ||
            termName.toLowerCase().includes(qLower)
          ) {
            list.push({
              source: 'official',
              id: mat.id,
              title: mat.title,
              description: mat.description,
              subjectId: mat.subjectId,
              subjectName,
              termId: mat.termId,
              termName,
              isInLibrary: localMaterialIds.has(mat.id),
            });
          }
        }
      }
    }

    // 2. Community Shares
    if (sourceFilter === 'all' || sourceFilter === 'community') {
      if (publicSharesData?.items) {
        for (const share of publicSharesData.items) {
          list.push({
            source: 'community',
            id: share.id,
            title: share.title,
            description: share.description,
            author: share.author,
            viewCount: share.viewCount,
            downloadCount: share.downloadCount,
            createdAt: share.createdAt,
            isInLibrary: localMaterialTitles.has(share.title.toLowerCase().trim()),
          });
        }
      }
    }

    // Sort the combined list
    if (sort === 'popular') {
      list.sort((a, b) => {
        const aDl = a.source === 'community' ? a.downloadCount : 9999;
        const bDl = b.source === 'community' ? b.downloadCount : 9999;
        if (bDl !== aDl) return bDl - aDl;
        return a.title.localeCompare(b.title);
      });
    } else {
      // sort === 'recent'
      list.sort((a, b) => {
        const aDate = a.source === 'community' ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.source === 'community' ? new Date(b.createdAt).getTime() : 0;
        if (bDate !== aDate) return bDate - aDate;
        return a.title.localeCompare(b.title);
      });
    }

    return list;
  }, [catalog, publicSharesData, localMaterialIds, localMaterialTitles, sourceFilter, search, sort]);

  const isLoading = isCatalogLoading || isSharesLoading;
  const isError = isCatalogError && isSharesError;

  return {
    items,
    isLoading,
    isError,
    sourceFilter,
    setSourceFilter,
    sort,
    setSort,
    search,
    setSearch,
  };
}
