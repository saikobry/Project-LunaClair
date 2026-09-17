import * as stylex from '@stylexjs/stylex';
import { Search, WifiOff } from 'lucide-react';
import { Page } from '../../../shared/ui/Page/Page';
import { Button } from '../../../shared/ui/Button/Button';
import { CardGridSkeleton } from '../../../shared/ui/Skeleton/Skeleton';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState/ErrorState';
import {
  DEFAULT_EXPLORE_SORT,
  useExploreContent,
} from '../../../features/discovery/hooks/useExploreContent';
import { useCloneShare } from '../../../features/discovery/hooks/useCloneShare';
import type { ExploreSortOption } from '../../../features/discovery/explore.types';
import { ExploreFilterBar } from './components/ExploreFilterBar';
import { ShareCard } from './components/ShareCard';
import { useExploreFilterDraft } from './hooks/useExploreFilterDraft';
import { describeExploreEmptyState, type ExploreFilters } from './utils/exploreFilters';
import { styles } from './styles/exploreScreen.stylex';

export type { ExploreFilters } from './utils/exploreFilters';

export interface ExploreScreenProps {
  /** Committed search query (`?q=`). */
  q?: string;
  /** Committed sort (`?sort=`; `popular` is the default and stays out of the URL). */
  sort?: ExploreSortOption;
  /**
   * Reports committed filter changes. Filters are URL state (`/explore?q=&sort=`),
   * so the route owner applies them and the screen never stores them itself.
   */
  onFiltersChange?: (next: ExploreFilters) => void;
  /** Opens the share landing page for a published study package. */
  onOpenShare: (shareId: string) => void;
  /**
   * Opens a **local** material — the cloned copy behind an `In My Library`
   * card. Required: the card's post-clone next step has no meaningful fallback
   * (a disabled Clone button is the dead end this replaces). Non-imported
   * shares are viewed on their landing surface via `onOpenShare`.
   */
  onOpenMaterial: (materialId: string) => void;
}

/**
 * Explore hub — shares-only discovery.
 *
 * A composer: filtering state lives in the URL (owned by the shell), the
 * in-progress query lives in `useExploreFilterDraft`, and the card and filter
 * bar are their own components.
 */
export function ExploreScreen({
  q,
  sort,
  onFiltersChange,
  onOpenShare,
  onOpenMaterial,
}: ExploreScreenProps) {
  const activeSort = sort ?? DEFAULT_EXPLORE_SORT;
  const { items, isLoading, isError, refetch } = useExploreContent({ q, sort: activeSort });
  const { cloneShare, isCloning } = useCloneShare();

  const { search, changeSearch, clearSearch, changeSort } = useExploreFilterDraft({
    q,
    sort,
    onCommit: onFiltersChange,
  });

  const emptyState = describeExploreEmptyState(q);

  return (
    <Page
      title="Explore"
      description="Discover published study packages from the community and official curriculum."
    >
      <ExploreFilterBar
        search={search}
        onSearchChange={changeSearch}
        sort={activeSort}
        onSortChange={changeSort}
      />

      {isLoading && <CardGridSkeleton count={6} variant="grid" />}

      {!isLoading && isError && (
        <ErrorState
          icon={<WifiOff size={56} />}
          title="Content unavailable"
          description="Could not load shared study packages from the platform API. Please check your connection and try again."
          action={
            <Button label="Try again" variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          icon={<Search size={28} />}
          iconVariant="muted"
          title={emptyState.title}
          description={emptyState.description}
          action={
            emptyState.showClear ? (
              <Button label="Clear search" variant="secondary" onClick={clearSearch}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          <p {...stylex.props(styles.resultCount)}>
            {items.length} {items.length === 1 ? 'result' : 'results'}
          </p>
          <div {...stylex.props(styles.grid)}>
            {items.map((item) => (
              <ShareCard
                key={item.id}
                item={item}
                isBusy={isCloning(item.id)}
                onOpen={onOpenShare}
                onClone={cloneShare}
                onOpenInLibrary={onOpenMaterial}
              />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

export default ExploreScreen;
