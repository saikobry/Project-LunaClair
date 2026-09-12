import * as stylex from '@stylexjs/stylex';
import {
  BookHeart,
  Inbox,
  LibraryBig,
  Plus,
  Search,
} from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { Page } from '../../../shared/ui/Page/Page';
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
    backgroundColor: 'var(--color-accent)',
    borderColor: 'var(--color-accent)',
    color: 'var(--color-text-on-accent)',
    ':hover': {
      borderColor: 'var(--color-accent)',
      color: 'var(--color-text-on-accent)',
      backgroundColor: 'var(--color-accent-muted)',
    },
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

interface LibraryViewProps {
  isLoading?: boolean;
  materials: StudyMaterial[];
  allTags: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
  onNewMaterial: () => void;
  onOpen: (material: StudyMaterial) => void;
  onEdit: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
  onManage: (material: StudyMaterial) => void;
  onNavigate?: (collectionId: string) => void;
  onBrowseAvailable: () => void;
  /** Unfiled mode: unassigned-materials view (title, description, empty state). */
  unfiledMode?: boolean;
  /** Navigates back to the full library (unfiled empty state). */
  onBrowseLibrary?: () => void;
}

interface LibraryFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
  materialCount: number;
}

/**
 * Search + tag filter controls for the library.
 *
 * Extracted from `LibraryView` so the parent keeps a flat render tree, and so
 * tag membership resolves against one `Set` instead of re-scanning
 * `selectedTags` for every pill.
 */
function LibraryFilterBar({
  searchQuery,
  onSearchChange,
  allTags,
  selectedTags,
  onToggleTag,
  onClearFilters,
  materialCount,
}: LibraryFilterBarProps) {
  const selectedTagSet = new Set(selectedTags);
  const hasActiveFilters = selectedTags.length > 0 || searchQuery.trim().length > 0;
  const hasTagBar = allTags.length > 0 || hasActiveFilters;

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
      {hasTagBar && (
        <div {...stylex.props(localStyles.filterBar)}>
          {allTags.map((tag) => {
            const isActive = selectedTagSet.has(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={isActive}
                {...stylex.props(localStyles.filterPill, isActive && localStyles.filterPillActive)}
                onClick={() => onToggleTag(tag)}
              >
                #{tag}
              </button>
            );
          })}
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
              Matching all selected tags · {materialCount} results
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface LibraryEmptyStatesProps {
  unfiledMode: boolean;
  onBrowseLibrary?: () => void;
  onBrowseAvailable: () => void;
}

/** Empty state for the unfiled view, or for a library with nothing in it yet. */
function LibraryEmptyStates({
  unfiledMode,
  onBrowseLibrary,
  onBrowseAvailable,
}: LibraryEmptyStatesProps) {
  if (unfiledMode) {
    return (
      <EmptyState
        icon={<Inbox size={56} />}
        title="Everything has a home."
        description="Your unfiled list is clear. Materials can still live in more than one collection."
        action={
          onBrowseLibrary ? (
            <Button
              label="Browse all materials"
              variant="primary"
              onClick={onBrowseLibrary}
            >
              Browse all materials
            </Button>
          ) : undefined
        }
      />
    );
  }

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

export default function LibraryView({
  isLoading = false,
  materials,
  allTags,
  searchQuery,
  onSearchChange,
  selectedTags,
  onToggleTag,
  onClearFilters,
  onNewMaterial,
  onOpen,
  onEdit,
  onDelete,
  onStartQuiz,
  onManage,
  onNavigate,
  onBrowseAvailable,
  unfiledMode = false,
  onBrowseLibrary,
}: LibraryViewProps) {
  const totalCount = materials.length;
  const description = isLoading
    ? undefined
    : unfiledMode
      ? 'Room to find a home · Materials not in any collection'
      : `${totalCount} ${totalCount === 1 ? 'material' : 'materials'}`;

  return (
    <Page
      title={unfiledMode ? 'Unfiled' : 'Study Library'}
      description={description}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            label="New Material"
            variant="primary"
            icon={<Plus size={18} />}
            onClick={onNewMaterial}
          >
            New Material
          </Button>
        </div>
      }
    >
      {/* Loading State — skeleton while queries are in-flight */}
      {isLoading && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Materials</h2>
          </div>
          <CardGridSkeleton count={6} />
        </div>
      )}

      {/* Filter Controls */}
      {!isLoading && materials.length > 0 && (
        <LibraryFilterBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          allTags={allTags}
          selectedTags={selectedTags}
          onToggleTag={onToggleTag}
          onClearFilters={onClearFilters}
          materialCount={materials.length}
        />
      )}

      {/* Materials */}
      {!isLoading && materials.length > 0 && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Materials</h2>
            <span {...stylex.props(localStyles.sectionCount)}>
              {materials.length} {materials.length === 1 ? 'material' : 'materials'}
            </span>
          </div>
          <MaterialGrid
            materials={materials}
            onOpen={onOpen}
            onEdit={onEdit}
            onDelete={onDelete}
            onStartQuiz={onStartQuiz}
            onManage={onManage}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {/* Empty State — unfiled variant, or an entirely empty library */}
      {!isLoading && materials.length === 0 && (
        <LibraryEmptyStates
          unfiledMode={unfiledMode}
          onBrowseLibrary={onBrowseLibrary}
          onBrowseAvailable={onBrowseAvailable}
        />
      )}
    </Page>
  );
}
