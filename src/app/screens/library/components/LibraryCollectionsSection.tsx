import * as stylex from '@stylexjs/stylex';
import { Search } from 'lucide-react';
import type { Collection } from '../../../../domain/collections/models/Collection';
import { CollectionShelf } from '../../../../features/collections/components/CollectionShelf';
import { Button } from '../../../../shared/ui/Button/Button';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import { Input } from '../../../../shared/ui/Input/Input';
import { screenStyles } from '../styles/libraryScreen.stylex';
import { PreviewStepper } from './PreviewStepper';
import { OVERVIEW_STEPS } from '../utils/overviewSteps';

export interface LibraryCollectionsSectionProps {
  /** False outside overview + collections views — renders nothing. */
  visible: boolean;
  isOverview: boolean;
  showSearch: boolean;
  collectionSearch: string;
  onCollectionSearchChange: (value: string) => void;
  onClearCollectionSearch: () => void;
  visibleCollections: Collection[];
  /** Full collection count (drives the empty state and stepper gate). */
  totalCollections: number;
  counts: Record<string, number>;
  isLoading: boolean;
  limit?: number;
  level: number;
  onLevelChange: (level: number) => void;
  onOpen: (collectionId: string) => void;
  onCreate: () => void;
  onViewAll: () => void;
}

/**
 * Collections half of the library: browser search, shelf-or-empty, and the
 * overview stepper. Extracted so `LibraryScreen` stays a composer.
 */
export function LibraryCollectionsSection({
  visible,
  isOverview,
  showSearch,
  collectionSearch,
  onCollectionSearchChange,
  onClearCollectionSearch,
  visibleCollections,
  totalCollections,
  counts,
  isLoading,
  limit,
  level,
  onLevelChange,
  onOpen,
  onCreate,
  onViewAll,
}: LibraryCollectionsSectionProps) {
  if (!visible) return null;
  return (
    <>
      {showSearch && (
        <div {...stylex.props(screenStyles.collectionSearch)}>
          <Input
            label=""
            labelHidden
            value={collectionSearch}
            onChange={onCollectionSearchChange}
            placeholder="Search collections..."
            startIcon={
              <Search size={15} style={{ color: 'var(--color-text-secondary)' }} />
            }
            clearable
          />
        </div>
      )}
      {visibleCollections.length > 0 || totalCollections === 0 ? (
        <CollectionShelf
          collections={visibleCollections}
          counts={counts}
          isLoading={isLoading}
          limit={limit}
          onOpen={onOpen}
          onCreate={onCreate}
        />
      ) : (
        <EmptyState
          icon={<Search size={56} />}
          title="No matching collections"
          description="Try another search to widen your view."
          action={
            <Button
              label="Clear collection search"
              variant="secondary"
              onClick={onClearCollectionSearch}
            >
              Clear search
            </Button>
          }
        />
      )}
      {isOverview && totalCollections > OVERVIEW_STEPS[0] && (
        <PreviewStepper
          shown={Math.min(limit ?? visibleCollections.length, visibleCollections.length)}
          total={visibleCollections.length}
          level={level}
          onLevelChange={onLevelChange}
          onViewAll={onViewAll}
          noun="collections"
        />
      )}
    </>
  );
}

export default LibraryCollectionsSection;
