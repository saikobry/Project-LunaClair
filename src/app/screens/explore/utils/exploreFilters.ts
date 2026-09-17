import type { ExploreSortOption } from '../../../../features/discovery/explore.types';

/**
 * Explore's filter pair. Both fields are URL state (`/explore?q=&sort=`), which
 * is why the shape is shared by the route owner, the screen, and the draft hook
 * instead of living in any one of them.
 */
export interface ExploreFilters {
  q?: string;
  sort?: ExploreSortOption;
}

export interface ExploreEmptyStateCopy {
  title: string;
  description: string;
  /** Whether the situation is recoverable by clearing the query. */
  showClear: boolean;
}

/**
 * Empty-state copy for the hub. A query miss and an empty hub are different
 * situations: only the first is something the user can undo from here.
 */
export function describeExploreEmptyState(q?: string): ExploreEmptyStateCopy {
  const query = q?.trim();

  if (query) {
    return {
      title: 'No study packages found',
      description: `No study packages matched "${query}".`,
      showClear: true,
    };
  }

  return {
    title: 'No study packages found',
    description: 'No study packages have been published yet. Check back soon!',
    showClear: false,
  };
}
