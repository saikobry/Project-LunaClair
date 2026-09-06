import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  Search,
  Download,
  Copy,
  Eye,
  Check,
  User,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import { Page } from '../../../shared/ui/Page/Page';
import { Button } from '../../../shared/ui/Button/Button';
import { Card } from '../../../shared/ui/Card/Card';
import { Chip } from '../../../shared/ui/Chip/Chip';
import { Input } from '../../../shared/ui/Input/Input';
import { CardGridSkeleton } from '../../../shared/ui/Skeleton/Skeleton';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState/ErrorState';
import { useExploreContent } from '../../../features/discovery/hooks/useExploreContent';
import { useCloneShare } from '../../../features/discovery/hooks/useCloneShare';
import type { ExploreContentItem, ExploreSortOption } from '../../../features/discovery/explore.types';

const mobile = '@media (max-width: 640px)';

const localStyles = stylex.create({
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    flexWrap: 'wrap',
    [mobile]: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 10,
    },
  },
  searchField: {
    flex: 1,
    minWidth: 240,
    [mobile]: {
      width: '100%',
      minWidth: 0,
    },
  },
  sortSelectWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  sortSelect: {
    padding: '8px 12px',
    fontSize: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    outlineStyle: 'none',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
    [mobile]: {
      gridTemplateColumns: '1fr',
    },
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 18,
    height: '100%',
    boxSizing: 'border-box',
    gap: 14,
  },
  cardTop: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  verifiedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 5,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    color: 'var(--color-primary, #6366f1)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
  },
  communityBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: 'var(--color-success, #10b981)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  cardDescription: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.45,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardMetaInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTop: '1px solid var(--color-border)',
    paddingTop: 12,
    marginTop: 'auto',
  },
  footerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  clickableCard: {
    cursor: 'pointer',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    },
  },
});

export interface ExploreScreenProps {
  /** Opens the share landing page for a published study package. */
  onOpenShare: (shareId: string) => void;
  /** @deprecated Legacy official-catalog hookups; Explore is shares-only. Kept optional for route compatibility. */
  onOpenMaterial?: (materialId: string) => void;
}

export function ExploreScreen({ onOpenShare }: ExploreScreenProps) {
  const { items, isLoading, isError, sort, setSort, search, setSearch } = useExploreContent();
  const { cloneShare, isCloning } = useCloneShare();

  const handleCardClick = (item: ExploreContentItem) => {
    onOpenShare(item.id);
  };

  const handleCardKeyDown = (item: ExploreContentItem) => (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(item);
    }
  };

  const renderCard = (item: ExploreContentItem) => {
    const isBusy = isCloning(item.id);

    return (
      <Card key={item.id}>
        <div
          {...stylex.props(localStyles.card, localStyles.clickableCard)}
          role="button"
          tabIndex={0}
          onClick={() => handleCardClick(item)}
          onKeyDown={handleCardKeyDown(item)}
          aria-label={`View share ${item.title}`}
        >
          <div {...stylex.props(localStyles.cardTop)}>
            <div {...stylex.props(localStyles.cardHeader)}>
              <div {...stylex.props(localStyles.titleColumn)}>
                <h3 {...stylex.props(localStyles.cardTitle)}>{item.title}</h3>
                <div {...stylex.props(localStyles.badgeRow)}>
                  {item.isVerified ? (
                    <span {...stylex.props(localStyles.verifiedBadge)}>
                      <Sparkles size={11} /> Verified Course
                    </span>
                  ) : (
                    <span {...stylex.props(localStyles.communityBadge)}>Community</span>
                  )}
                  {item.author && (
                    <span {...stylex.props(localStyles.metaItem)}>
                      <User size={12} />
                      {item.author}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {item.description && (
              <p {...stylex.props(localStyles.cardDescription)}>{item.description}</p>
            )}

            <div {...stylex.props(localStyles.cardMetaInfo)}>
              <span {...stylex.props(localStyles.metaItem)}>
                <Download size={12} />
                {item.downloadCount} {item.downloadCount === 1 ? 'download' : 'downloads'}
              </span>
              <span {...stylex.props(localStyles.metaItem)}>
                <Eye size={12} />
                {item.viewCount} {item.viewCount === 1 ? 'view' : 'views'}
              </span>
            </div>
          </div>

          <div {...stylex.props(localStyles.cardFooter)}>
            <div>
              {item.isInLibrary && (
                <Chip variant="accent">
                  <Check size={12} /> In My Library
                </Chip>
              )}
            </div>

            <div {...stylex.props(localStyles.footerActions)}>
              <Button
                label={`View Share ${item.title}`}
                variant="secondary"
                icon={<Eye size={13} />}
                onClick={(e) => {
                  e?.stopPropagation();
                  onOpenShare(item.id);
                }}
              >
                View
              </Button>
              <Button
                label={`Clone ${item.title} to your library`}
                variant="primary"
                icon={<Copy size={13} />}
                isLoading={isBusy}
                isDisabled={isBusy || item.isInLibrary}
                onClick={async (e) => {
                  e?.stopPropagation();
                  if (item.isInLibrary) return;
                  await cloneShare(item.id);
                }}
              >
                Clone to Library
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Page
      title="Explore"
      description="Discover published study packages from the community and official curriculum."
    >
      {/* Search & Sort Bar */}
      <div {...stylex.props(localStyles.filterBar)}>
        <div {...stylex.props(localStyles.searchField)}>
          <Input
            label="Search explore content"
            labelHidden
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="Search study packages, authors..."
            startIcon={<Search size={16} />}
            clearable
            size="md"
          />
        </div>

        <div {...stylex.props(localStyles.sortSelectWrapper)}>
          <select
            aria-label="Sort explore items"
            value={sort}
            onChange={(e) => setSort(e.target.value as ExploreSortOption)}
            {...stylex.props(localStyles.sortSelect)}
          >
            <option value="popular">Popular</option>
            <option value="recent">Recent</option>
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && <CardGridSkeleton count={6} variant="grid" />}

      {/* Error State */}
      {!isLoading && isError && (
        <ErrorState
          icon={<WifiOff size={56} />}
          title="Content unavailable"
          description="Could not load shared study packages from the platform API. Please check your connection and try again."
        />
      )}

      {/* Filtered Empty State */}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          icon={<Search size={28} />}
          iconVariant="muted"
          title="No study packages found"
          description={
            search.trim()
              ? `No study packages matched "${search.trim()}".`
              : 'No study packages have been published yet. Check back soon!'
          }
          action={
            search.trim() ? (
              <Button
                label="Clear search"
                variant="secondary"
                onClick={() => setSearch('')}
              >
                Clear search
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Grid of Share Cards */}
      {!isLoading && !isError && items.length > 0 && (
        <div {...stylex.props(localStyles.grid)}>{items.map(renderCard)}</div>
      )}
    </Page>
  );
}

export default ExploreScreen;
