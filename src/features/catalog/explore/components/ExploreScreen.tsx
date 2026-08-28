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
import { Page } from '../../../../shared/ui/Page';
import { Button } from '../../../../shared/ui/Button/Button';
import { Card } from '../../../../shared/ui/Card';
import { Chip } from '../../../../shared/ui/Chip/Chip';
import { Input } from '../../../../shared/ui/Input/Input';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '../../../../shared/ui/SegmentedControl/SegmentedControl';
import { CardGridSkeleton } from '../../../../shared/ui/Skeleton/Skeleton';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import { ErrorState } from '../../../../shared/ui/ErrorState/ErrorState';
import { useExploreContent } from '../hooks/useExploreContent';
import { useImportMaterial } from '../../available/hooks/mutations/useImportMaterial';
import { useCloneShare } from '../hooks/useCloneShare';
import type { ExploreContentItem, ExploreSourceFilter, ExploreSortOption } from '../explore.types';

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
  segmentedFilter: {
    flexShrink: 0,
    minWidth: 320,
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
  officialBadge: {
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
  onOpenMaterial: (materialId: string) => void;
  onPreview: (materialId: string) => void;
  onOpenShare: (shareId: string) => void;
}

export function ExploreScreen({ onOpenMaterial, onPreview, onOpenShare }: ExploreScreenProps) {
  const {
    items,
    isLoading,
    isError,
    sourceFilter,
    setSourceFilter,
    sort,
    setSort,
    search,
    setSearch,
  } = useExploreContent();

  const importMaterialMutation = useImportMaterial();
  const { cloneShare, isCloning } = useCloneShare();

  const handleCardClick = (item: ExploreContentItem) => {
    if (item.source === 'official') {
      if (item.isInLibrary) {
        onOpenMaterial(item.id);
      } else {
        onPreview(item.id);
      }
    } else {
      onOpenShare(item.id);
    }
  };

  const handleCardKeyDown = (item: ExploreContentItem) => (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(item);
    }
  };

  const renderCard = (item: ExploreContentItem) => {
    const isOfficial = item.source === 'official';
    const isBusy = isOfficial
      ? importMaterialMutation.isPending && importMaterialMutation.variables === item.id
      : isCloning(item.id);

    return (
      <Card key={`${item.source}-${item.id}`}>
        <div
          {...stylex.props(localStyles.card, localStyles.clickableCard)}
          role="button"
          tabIndex={0}
          onClick={() => handleCardClick(item)}
          onKeyDown={handleCardKeyDown(item)}
          aria-label={
            isOfficial
              ? item.isInLibrary
                ? `Open ${item.title}`
                : `Preview ${item.title}`
              : `View share ${item.title}`
          }
        >
          <div {...stylex.props(localStyles.cardTop)}>
            <div {...stylex.props(localStyles.cardHeader)}>
              <div {...stylex.props(localStyles.titleColumn)}>
                <h3 {...stylex.props(localStyles.cardTitle)}>{item.title}</h3>
                <div {...stylex.props(localStyles.badgeRow)}>
                  {isOfficial ? (
                    <>
                      <span {...stylex.props(localStyles.officialBadge)}>
                        <Sparkles size={11} /> Verified Course
                      </span>
                      {item.subjectName && (
                        <Chip variant="neutral">{item.subjectName}</Chip>
                      )}
                      {item.termName && (
                        <Chip variant="neutral">{item.termName}</Chip>
                      )}
                    </>
                  ) : (
                    <>
                      <span {...stylex.props(localStyles.communityBadge)}>
                        Community
                      </span>
                      {item.author && (
                        <span {...stylex.props(localStyles.metaItem)}>
                          <User size={12} />
                          {item.author}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {item.description && (
              <p {...stylex.props(localStyles.cardDescription)}>{item.description}</p>
            )}

            {!isOfficial && (
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
            )}
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
              {isOfficial ? (
                <>
                  <Button
                    label="Preview"
                    variant="secondary"
                    icon={<Eye size={13} />}
                    onClick={(e) => {
                      e?.stopPropagation();
                      onPreview(item.id);
                    }}
                  >
                    Preview
                  </Button>
                  {!item.isInLibrary && (
                    <Button
                      label={`Add ${item.title} to your library`}
                      variant="primary"
                      icon={<Download size={13} />}
                      isLoading={isBusy}
                      isDisabled={isBusy}
                      onClick={(e) => {
                        e?.stopPropagation();
                        importMaterialMutation.mutate(item.id);
                      }}
                    >
                      Add to Library
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    label="View Share"
                    variant="secondary"
                    icon={<Eye size={13} />}
                    onClick={(e) => {
                      e?.stopPropagation();
                      onOpenShare(item.id);
                    }}
                  >
                    View
                  </Button>
                  {!item.isInLibrary && (
                    <Button
                      label={`Clone ${item.title} to your library`}
                      variant="primary"
                      icon={<Copy size={13} />}
                      isLoading={isBusy}
                      isDisabled={isBusy}
                      onClick={async (e) => {
                        e?.stopPropagation();
                        await cloneShare(item.id);
                      }}
                    >
                      Clone to Library
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Page
      title="Explore"
      description="Discover official curriculum coursework and peer-shared community study packages."
    >
      {/* Search & Filter Bar */}
      <div {...stylex.props(localStyles.filterBar)}>
        <div {...stylex.props(localStyles.searchField)}>
          <Input
            label="Search explore content"
            labelHidden
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="Search materials, subjects, authors..."
            startIcon={<Search size={16} />}
            clearable
            size="md"
          />
        </div>

        <div {...stylex.props(localStyles.segmentedFilter)}>
          <SegmentedControl
            value={sourceFilter}
            onChange={(val: string) => setSourceFilter(val as ExploreSourceFilter)}
            label="Content source filter"
            size="md"
            layout="fill"
          >
            <SegmentedControlItem value="all" label="All" />
            <SegmentedControlItem value="official" label="Official" />
            <SegmentedControlItem value="community" label="Community" />
          </SegmentedControl>
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
          description="Could not load explore content from the platform API. Please check your connection and try again."
        />
      )}

      {/* Filtered Empty State */}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          icon={<Search size={28} />}
          iconVariant="muted"
          title="No materials found"
          description={
            search.trim()
              ? `No materials matched "${search.trim()}".`
              : 'No materials match the selected source filter.'
          }
          action={
            <Button
              label="Clear filters"
              variant="secondary"
              onClick={() => {
                setSearch('');
                setSourceFilter('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}

      {/* Grid of Unified Content Cards */}
      {!isLoading && !isError && items.length > 0 && (
        <div {...stylex.props(localStyles.grid)}>{items.map(renderCard)}</div>
      )}
    </Page>
  );
}

export default ExploreScreen;
