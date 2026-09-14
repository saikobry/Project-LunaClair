import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { BookHeart, Inbox, LibraryBig, Search, X } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { MaterialMembershipFilter } from '../types/libraryFilter.types';
import { Button } from '../../../shared/ui/Button/Button';
import { Input } from '../../../shared/ui/Input/Input';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import MaterialGrid from './MaterialGrid';
import { CardGridSkeleton } from '../../../shared/ui/Skeleton/Skeleton';

const localStyles = stylex.create({
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  filterContainer: {
    marginBottom: 24,
  },
  searchContainer: {
    marginBottom: 16,
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 12px',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
    ':hover': {
      borderColor: 'var(--color-accent)',
      color: 'var(--color-text-primary)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  filterPillActive: {
    backgroundColor: 'var(--color-accent-muted)',
    borderColor: 'var(--color-accent)',
    color: 'var(--color-text-accent)',
    ':hover': {
      borderColor: 'var(--color-accent)',
      color: 'var(--color-text-accent)',
      backgroundColor: 'var(--color-accent-muted)',
    },
  },
  /** Dimmed `#` sigil; inherits the pill ink when selected. */
  filterHash: {
    color: 'var(--color-text-disabled)',
  },
  filterHashActive: {
    color: 'inherit',
  },
  /** Membership lens — visually separated from the `#tag` pills beside it. */
  membershipGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
    marginRight: 4,
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: 'var(--color-border)',
  },
  membershipPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 12px',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
    ':hover': {
      borderColor: 'var(--color-accent)',
      color: 'var(--color-text-primary)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  membershipPillActive: {
    backgroundColor: 'var(--color-accent-muted)',
    borderColor: 'var(--color-accent)',
    color: 'var(--color-text-primary)',
  },
  membershipCaption: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    margin: '10px 0 0',
  },
  clearFiltersBtn: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    textDecoration: 'underline',
    marginLeft: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    ':hover': {
      color: 'var(--color-text-primary)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  resultCount: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
});

const MEMBERSHIP_OPTIONS: { value: MaterialMembershipFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'collected', label: 'In a collection' },
  { value: 'uncollected', label: 'Not in a collection' },
];

/** Tag pills shown before the `+N more` expander earns its place. */
const VISIBLE_TAG_COUNT = 8;

export interface LibraryViewProps {
  isLoading?: boolean;
  /** Materials matching the active search + tags + membership filters. */
  materials: StudyMaterial[];
  /**
   * Caps the rendered cards (the header count still reflects the full list).
   * The screen owns the stepper that grows this — overview previews stay small
   * while the materials tab passes no limit.
   */
  limit?: number;
  /** Total materials in the library, ignoring filters (drives the empty states). */
  totalMaterialCount: number;
  allTags: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
  membershipFilter: MaterialMembershipFilter;
  onMembershipFilterChange: (filter: MaterialMembershipFilter) => void;
  onOpen: (material: StudyMaterial) => void;
  onEdit: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
  onManage: (material: StudyMaterial) => void;
  /** Navigates to a collection (material-card membership badges). */
  onNavigate?: (collectionId: string) => void;
  onBrowseAvailable: () => void;
}

interface LibraryFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
  materialCount: number;
  membershipFilter: MaterialMembershipFilter;
  onMembershipFilterChange: (filter: MaterialMembershipFilter) => void;
}

/**
 * Search + membership + tag filter controls for the library.
 *
 * `#tag` pills narrow by tag (AND); the membership lens is a separate, mutually
 * exclusive control rendered in its own group so the two are never confused.
 */
function LibraryFilterBar({
  searchQuery,
  onSearchChange,
  allTags,
  selectedTags,
  onToggleTag,
  onClearFilters,
  materialCount,
  membershipFilter,
  onMembershipFilterChange,
}: LibraryFilterBarProps) {
  const selectedTagSet = new Set(selectedTags);
  const hasActiveFilters = selectedTags.length > 0 || searchQuery.trim().length > 0;
  // Capped pill row: the top tags plus any selected tag outside the cap
  // (a chosen filter must never disappear under the expander).
  const [showAllTags, setShowAllTags] = useState(false);
  const visibleTags = showAllTags
    ? allTags
    : allTags.filter((tag, i) => i < VISIBLE_TAG_COUNT || selectedTagSet.has(tag));
  const hiddenTagCount = allTags.length - visibleTags.length;

  return (
    <div {...stylex.props(localStyles.filterContainer)}>
      <div {...stylex.props(localStyles.searchContainer)}>
        <Input
          label=""
          labelHidden
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search your materials, ideas, or tags..."
          startIcon={
            <Search size={15} style={{ color: 'var(--color-text-secondary)' }} />
          }
          clearable
        />
      </div>

      <div {...stylex.props(localStyles.filterBar)}>
        <div
          {...stylex.props(localStyles.membershipGroup)}
          role="group"
          aria-label="Filter by collection membership"
        >
          {MEMBERSHIP_OPTIONS.map((option) => {
            const isActive = membershipFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                {...stylex.props(
                  localStyles.membershipPill,
                  isActive && localStyles.membershipPillActive,
                )}
                onClick={() => onMembershipFilterChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {visibleTags.map((tag) => {
          const isActive = selectedTagSet.has(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={isActive}
              {...stylex.props(localStyles.filterPill, isActive && localStyles.filterPillActive)}
              onClick={() => onToggleTag(tag)}
            >
              <span
                aria-hidden="true"
                {...stylex.props(localStyles.filterHash, isActive && localStyles.filterHashActive)}
              >
                #
              </span>
              {tag}
              {isActive && <X size={10} aria-hidden="true" />}
            </button>
          );
        })}

        {hiddenTagCount > 0 && (
          <button
            type="button"
            {...stylex.props(localStyles.clearFiltersBtn)}
            onClick={() => setShowAllTags(true)}
            aria-label={`Show ${hiddenTagCount} more tags`}
          >
            +{hiddenTagCount} more
          </button>
        )}
        {showAllTags && allTags.length > VISIBLE_TAG_COUNT && (
          <button
            type="button"
            {...stylex.props(localStyles.clearFiltersBtn)}
            onClick={() => setShowAllTags(false)}
          >
            Show less
          </button>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            {...stylex.props(localStyles.clearFiltersBtn)}
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        )}

        {selectedTags.length > 1 && (
          <span {...stylex.props(localStyles.resultCount)}>
            Matching any selected tag · {materialCount} results
          </span>
        )}
      </div>

      {membershipFilter === 'uncollected' && (
        <p {...stylex.props(localStyles.membershipCaption)}>
          Materials in no collection.
        </p>
      )}
      {membershipFilter === 'collected' && (
        <p {...stylex.props(localStyles.membershipCaption)}>
          Materials that belong to at least one collection.
        </p>
      )}
    </div>
  );
}

interface LibraryEmptyStatesProps {
  totalMaterialCount: number;
  membershipFilter: MaterialMembershipFilter;
  onMembershipFilterChange: (filter: MaterialMembershipFilter) => void;
  onClearFilters: () => void;
  onBrowseAvailable: () => void;
}

/**
 * Three distinct zero-result situations, in priority order:
 * an empty library, a cleared `uncollected` lens, and an over-narrow filter.
 */
function LibraryEmptyStates({
  totalMaterialCount,
  membershipFilter,
  onMembershipFilterChange,
  onClearFilters,
  onBrowseAvailable,
}: LibraryEmptyStatesProps) {
  if (totalMaterialCount === 0) {
    return (
      <EmptyState
        icon={<BookHeart size={56} />}
        title="Your library is empty"
        description="Explore study packages on the Explore hub and clone them to your library. Cloned packages are available offline, including their quizzes."
        action={
          <Button
            label="Explore Study Packages"
            variant="primary"
            icon={<LibraryBig size={18} />}
            onClick={onBrowseAvailable}
          >
            Explore Study Packages
          </Button>
        }
      />
    );
  }

  if (membershipFilter === 'uncollected') {
    return (
      <EmptyState
        icon={<Inbox size={56} />}
        title="Everything has a home."
        description="No materials outside a collection. Materials can still live in more than one collection."
        action={
          <Button
            label="Browse all materials"
            variant="primary"
            onClick={() => onMembershipFilterChange('all')}
          >
            Browse all materials
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={<Search size={56} />}
      title="No materials found"
      description="Try another search or remove a tag to widen your view."
      action={
        <Button label="Clear filters" variant="secondary" onClick={onClearFilters}>
          Clear filters
        </Button>
      }
    />
  );
}

/**
 * Library materials section — the search/membership/tag filter bar, the material
 * grid, and the zero-result states.
 *
 * Page chrome (title, description, primary actions) belongs to the route screen;
 * the Collections shelf is composed above this by `LibraryScreen`.
 */
export default function LibraryView({
  isLoading = false,
  materials,
  limit,
  totalMaterialCount,
  allTags,
  searchQuery,
  onSearchChange,
  selectedTags,
  onToggleTag,
  onClearFilters,
  membershipFilter,
  onMembershipFilterChange,
  onOpen,
  onEdit,
  onDelete,
  onStartQuiz,
  onManage,
  onNavigate,
  onBrowseAvailable,
}: LibraryViewProps) {
  return (
    <section {...stylex.props(localStyles.section)} aria-labelledby="library-materials-heading">
      <div {...stylex.props(localStyles.sectionHeader)}>
        <h2 id="library-materials-heading" {...stylex.props(localStyles.sectionTitle)}>
          Materials
        </h2>
        {!isLoading && (
          <span {...stylex.props(localStyles.sectionCount)}>
            {materials.length} {materials.length === 1 ? 'material' : 'materials'}
          </span>
        )}
      </div>

      {/* Loading State — skeleton while queries are in-flight */}
      {isLoading && <CardGridSkeleton count={6} />}

      {/* Filter Controls */}
      {!isLoading && totalMaterialCount > 0 && (
        <LibraryFilterBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          allTags={allTags}
          selectedTags={selectedTags}
          onToggleTag={onToggleTag}
          onClearFilters={onClearFilters}
          materialCount={materials.length}
          membershipFilter={membershipFilter}
          onMembershipFilterChange={onMembershipFilterChange}
        />
      )}

      {/* Materials */}
      {!isLoading && materials.length > 0 && (
        <MaterialGrid
          materials={limit === undefined ? materials : materials.slice(0, limit)}
          onOpen={onOpen}
          onEdit={onEdit}
          onDelete={onDelete}
          onStartQuiz={onStartQuiz}
          onManage={onManage}
          onNavigate={onNavigate}
          onToggleTag={onToggleTag}
          selectedTags={selectedTags}
        />
      )}

      {/* Empty States — empty library, cleared uncollected lens, or over-narrow filters */}
      {!isLoading && materials.length === 0 && (
        <LibraryEmptyStates
          totalMaterialCount={totalMaterialCount}
          membershipFilter={membershipFilter}
          onMembershipFilterChange={onMembershipFilterChange}
          onClearFilters={onClearFilters}
          onBrowseAvailable={onBrowseAvailable}
        />
      )}

    </section>
  );
}
