import { useState, useMemo, type KeyboardEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, Download, Search, Trash2, WifiOff } from 'lucide-react';
import type { StudyMaterial } from '../../../../domain/library';
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
import { ActionMenu, ActionMenuItem } from '../../../../shared/components/ActionMenu';
import { useAvailableCatalog } from '../hooks/queries/useAvailableCatalog';
import { useImportMaterial } from '../hooks/mutations/useImportMaterial';
import { useImportSubject } from '../hooks/mutations/useImportSubject';
import { useRemoveImportedMaterial } from '../hooks/mutations/useRemoveImportedMaterial';
import { useLibrary } from '../../materials/hooks/queries/useLibrary';
import { styles } from '../../shared/styles/library.stylex';

type AvailabilityFilter = 'all' | 'available' | 'imported';

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
    minWidth: 280,
    [mobile]: {
      width: '100%',
      minWidth: 0,
    },
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionTitleGroup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  sectionCount: {
    fontSize: 13,
    color: 'var(--color-text-disabled)',
  },
  sectionHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  // Single-column card list (this screen renders one card per row)
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 16,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  clickable: {
    cursor: 'pointer',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    ':hover': {
      transform: 'translateY(-2px)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  cardDescription: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  emptyResults: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    gap: 12,
  },
  emptyResultsIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'var(--color-background-muted)',
    color: 'var(--color-text-disabled)',
  },
  emptyResultsTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  emptyResultsText: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    maxWidth: 320,
    lineHeight: 1.5,
  },
});

interface AvailableMaterialsScreenProps {
  onOpenMaterial: (materialId: string) => void;
  /** Open the read-only preview route for a material. */
  onPreview: (materialId: string) => void;
}

/**
 * "Available Materials" — the remote D1 catalog surfaced as server state.
 *
 * Nothing here is auto-imported into Dexie. Each material shows its import
 * status (available remotely / in the local library) and an explicit
 * [ Add to Library ] / [ Remove from Library ] action. Subject section headers
 * provide an [ Add All to Library ] action to import all missing materials in a subject.
 * Imported materials open via the normal workspace route. Clicking an available
 * material opens its read-only preview surface.
 *
 * Includes client-side title/description search and availability status filtering.
 */
export function AvailableMaterialsScreen({ onOpenMaterial, onPreview }: AvailableMaterialsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AvailabilityFilter>('all');

  const { catalog, isLoading, isError } = useAvailableCatalog();
  const { materials: localMaterials } = useLibrary();
  const importMutation = useImportMaterial();
  const importSubjectMutation = useImportSubject();
  const removeMutation = useRemoveImportedMaterial();

  const localIds = useMemo(() => new Set(localMaterials.map((m) => m.id)), [localMaterials]);

  // Step 1: Filter materials by search query & status filter
  const filteredMaterials = useMemo(() => {
    const rawList = catalog?.materials ?? [];
    const query = searchQuery.trim().toLowerCase();

    return rawList.filter((material) => {
      // 1. Search text filter (title or description)
      if (query) {
        const titleMatch = material.title.toLowerCase().includes(query);
        const descMatch = (material.description ?? '').toLowerCase().includes(query);
        if (!titleMatch && !descMatch) {
          return false;
        }
      }

      // 2. Status filter
      const isImported = localIds.has(material.id);
      if (statusFilter === 'available' && isImported) {
        return false;
      }
      if (statusFilter === 'imported' && !isImported) {
        return false;
      }

      return true;
    });
  }, [catalog?.materials, searchQuery, statusFilter, localIds]);

  // Step 2: Group filtered materials by subject and ungrouped
  const { materialsBySubject, ungrouped } = useMemo(() => {
    const bySubject = new Map<string, StudyMaterial[]>();
    const withoutSubject: StudyMaterial[] = [];

    for (const material of filteredMaterials) {
      if (material.subjectId) {
        const list = bySubject.get(material.subjectId) ?? [];
        list.push(material);
        bySubject.set(material.subjectId, list);
      } else {
        withoutSubject.push(material);
      }
    }

    return { materialsBySubject: bySubject, ungrouped: withoutSubject };
  }, [filteredMaterials]);

  const subjects = catalog?.subjects ?? [];
  const termsById = new Map((catalog?.terms ?? []).map((t) => [t.id, t]));

  const totalCatalogMaterials = catalog?.materials.length ?? 0;
  const isFiltered = Boolean(searchQuery.trim() || statusFilter !== 'all');

  const description = isLoading
    ? undefined
    : catalog
      ? isFiltered
        ? `Showing ${filteredMaterials.length} of ${totalCatalogMaterials} ${totalCatalogMaterials === 1 ? 'material' : 'materials'}`
        : `${totalCatalogMaterials} ${totalCatalogMaterials === 1 ? 'material' : 'materials'} available from the platform`
      : undefined;

  const handleCardClick = (material: StudyMaterial) => {
    if (localIds.has(material.id)) {
      onOpenMaterial(material.id);
    } else {
      onPreview(material.id);
    }
  };

  const handleCardKeyDown = (material: StudyMaterial) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(material);
    }
  };

  const renderMaterialCard = (material: StudyMaterial) => {
    const imported = localIds.has(material.id);
    const busy = importMutation.isPending || removeMutation.isPending || importSubjectMutation.isPending;

    return (
      <Card key={material.id}>
        <div
          {...stylex.props(
            localStyles.card,
            localStyles.clickable,
          )}
          role="button"
          tabIndex={0}
          onClick={() => handleCardClick(material)}
          onKeyDown={handleCardKeyDown(material)}
          aria-label={imported ? `Open ${material.title}` : `Preview ${material.title}`}
        >
          <div {...stylex.props(localStyles.cardHeader)}>
            <div {...stylex.props(localStyles.titleColumn)}>
              <h3 {...stylex.props(localStyles.cardTitle)}>{material.title}</h3>
              <div {...stylex.props(localStyles.badgeRow)}>
                {material.termId && termsById.get(material.termId) && (
                  <Chip variant="neutral">{termsById.get(material.termId)!.title}</Chip>
                )}
                <Chip variant={imported ? 'accent' : 'neutral'}>
                  {imported ? 'In My Library' : 'Available'}
                </Chip>
              </div>
            </div>
            {imported && (
              <ActionMenu label={`Actions for ${material.title}`}>
                <ActionMenuItem
                  icon={<Trash2 size={14} />}
                  label="Remove from Library"
                  description="Remove this material from your library"
                  isDisabled={busy}
                  onClick={() => removeMutation.mutate(material.id)}
                />
              </ActionMenu>
            )}
          </div>
          {material.description && (
            <p {...stylex.props(localStyles.cardDescription)}>{material.description}</p>
          )}
          {!imported && (
            <div {...stylex.props(localStyles.cardFooter)}>
              <Button
                label={`Add ${material.title} to your library`}
                variant="primary"
                icon={<Download size={14} />}
                isDisabled={busy}
                onClick={(e) => {
                  e?.stopPropagation();
                  importMutation.mutate(material.id);
                }}
              >
                Add to Library
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <Page title="Available Materials" description={description}>
      {/* Loading State */}
      {isLoading && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Loading…</h2>
          </div>
          <CardGridSkeleton count={6} variant="list" />
        </div>
      )}

      {/* Error / Offline state — catalog never fetched */}
      {!isLoading && (isError || !catalog) && (
        <div {...stylex.props(styles.emptyState)}>
          <div {...stylex.props(styles.emptyIcon)}>
            <WifiOff size={64} />
          </div>
          <h2 {...stylex.props(styles.emptyTitle)}>Catalog unavailable</h2>
          <p {...stylex.props(styles.emptyText)}>
            The platform catalog could not be loaded — this is your first visit
            while offline, or the API is unreachable. Connect to the internet and
            try again.
          </p>
        </div>
      )}

      {/* Filter and Search Bar */}
      {!isLoading && catalog && totalCatalogMaterials > 0 && (
        <div {...stylex.props(localStyles.filterBar)}>
          <div {...stylex.props(localStyles.searchField)}>
            <Input
              label="Search available materials"
              labelHidden
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              placeholder="Search materials by title or description..."
              startIcon={<Search size={16} />}
              clearable
              size="md"
            />
          </div>
          <div {...stylex.props(localStyles.segmentedFilter)}>
            <SegmentedControl
              value={statusFilter}
              onChange={(v: string) => setStatusFilter(v as AvailabilityFilter)}
              label="Availability filter"
              size="md"
              layout="fill"
            >
              <SegmentedControlItem value="all" label="All" />
              <SegmentedControlItem value="available" label="Available" />
              <SegmentedControlItem value="imported" label="In Library" />
            </SegmentedControl>
          </div>
        </div>
      )}

      {/* Filtered Empty Results State */}
      {!isLoading && catalog && totalCatalogMaterials > 0 && filteredMaterials.length === 0 && (
        <div {...stylex.props(localStyles.emptyResults)}>
          <div {...stylex.props(localStyles.emptyResultsIcon)}>
            <Search size={24} />
          </div>
          <h3 {...stylex.props(localStyles.emptyResultsTitle)}>No materials found</h3>
          <p {...stylex.props(localStyles.emptyResultsText)}>
            {searchQuery.trim()
              ? `No materials matched "${searchQuery.trim()}".`
              : 'No materials match the selected availability filter.'}
          </p>
          <Button
            label="Clear filters"
            variant="secondary"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Subject groups */}
      {!isLoading && catalog && subjects.map((subject) => {
        const group = materialsBySubject.get(subject.id) ?? [];
        if (group.length === 0) return null;

        const unimportedCount = group.filter((m) => !localIds.has(m.id)).length;
        const allImported = unimportedCount === 0 && group.length > 0;
        const isSubjectPending = importSubjectMutation.isPending && importSubjectMutation.variables === subject.id;
        const busy = importMutation.isPending || removeMutation.isPending || importSubjectMutation.isPending;

        return (
          <div key={subject.id} {...stylex.props(localStyles.section)}>
            <div {...stylex.props(localStyles.sectionHeader)}>
              <div {...stylex.props(localStyles.sectionTitleGroup)}>
                <h2 {...stylex.props(localStyles.sectionTitle)}>{subject.title}</h2>
                <span {...stylex.props(localStyles.sectionCount)}>
                  {group.length} {group.length === 1 ? 'material' : 'materials'}
                </span>
              </div>
              <div {...stylex.props(localStyles.sectionHeaderActions)}>
                {allImported ? (
                  <Chip variant="accent">All in Library</Chip>
                ) : (
                  <Button
                    label={`Add all ${unimportedCount} materials from ${subject.title} to your library`}
                    variant="secondary"
                    icon={<Download size={14} />}
                    isDisabled={busy}
                    isLoading={isSubjectPending}
                    onClick={() => importSubjectMutation.mutate(subject.id)}
                  >
                    Add All to Library ({unimportedCount})
                  </Button>
                )}
              </div>
            </div>
            <div {...stylex.props(localStyles.list)}>
              {group.map(renderMaterialCard)}
            </div>
          </div>
        );
      })}

      {/* Ungrouped materials */}
      {!isLoading && catalog && ungrouped.length > 0 && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Other</h2>
            <span {...stylex.props(localStyles.sectionCount)}>
              {ungrouped.length} {ungrouped.length === 1 ? 'material' : 'materials'}
            </span>
          </div>
          <div {...stylex.props(localStyles.list)}>
            {ungrouped.map(renderMaterialCard)}
          </div>
        </div>
      )}

      {/* Empty catalog (when platform catalog itself has 0 items) */}
      {!isLoading && catalog && totalCatalogMaterials === 0 && (
        <div {...stylex.props(styles.emptyState)}>
          <div {...stylex.props(styles.emptyIcon)}>
            <BookOpen size={64} />
          </div>
          <h2 {...stylex.props(styles.emptyTitle)}>No materials available</h2>
          <p {...stylex.props(styles.emptyText)}>
            The platform catalog is empty. Check back later.
          </p>
        </div>
      )}
    </Page>
  );
}

export default AvailableMaterialsScreen;
