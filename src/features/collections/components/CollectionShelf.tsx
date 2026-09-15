import * as stylex from '@stylexjs/stylex';
import { ChevronRight, Layers, Plus } from 'lucide-react';
import { DEFAULT_COLLECTION_COLOR, type Collection } from '../../../domain/collections/models/Collection';
import { Button } from '../../../shared/ui/Button/Button';
import { VIRTUALIZE_AFTER_ITEM_COUNT } from '../../../shared/constants/listRendering';
import { getCollectionIcon } from '../modals/collectionAppearance';
import { shelfStyles } from './collectionShelf.stylex';
import { VirtualShelfGrid } from './VirtualShelfGrid';

export interface CollectionShelfProps {
  collections: Collection[];
  /** Per-collection member counts (`collectionId -> count`). */
  counts: Record<string, number>;
  isLoading?: boolean;
  /**
   * Caps the rendered cards (the header count still reflects the full list).
   * The screen owns the stepper that grows this — overview previews stay small
   * while the full browser passes no limit.
   */
  limit?: number;
  onOpen: (collectionId: string) => void;
  onCreate: () => void;
}

/**
 * Library's Collections shelf — a horizontal band of playlist cards stacked
 * above the materials grid.
 *
 * Pure presentation: the screen resolves collections and counts and passes them
 * in (mirrors the `modals/` no-hooks rule), so this component stays
 * fast-refresh-clean and independently testable.
 */
export function CollectionShelf({
  collections,
  counts,
  isLoading = false,
  limit,
  onOpen,
  onCreate,
}: CollectionShelfProps) {
  if (isLoading && collections.length === 0) return null;

  const visible = limit === undefined ? collections : collections.slice(0, limit);
  // Past the threshold the grid virtualizes — but never under a preview cap:
  // overview always passes `limit`, so it stays on the plain capped path.
  const virtualized =
    limit === undefined && collections.length > VIRTUALIZE_AFTER_ITEM_COUNT;

  return (
    <section {...stylex.props(shelfStyles.section)} aria-labelledby="library-collections-heading">
      <div {...stylex.props(shelfStyles.header)}>
        <div {...stylex.props(shelfStyles.headerLeft)}>
          <h2 id="library-collections-heading" {...stylex.props(shelfStyles.title)}>
            Collections
          </h2>
          {collections.length > 0 && (
            <span {...stylex.props(shelfStyles.count)}>
              {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
            </span>
          )}
        </div>
        {/* Redundant beside the empty-state CTA below when there is nothing yet. */}
        {collections.length > 0 && (
          <Button
            label="New Collection"
            variant="ghost"
            icon={<Plus size={16} />}
            onClick={onCreate}
          />
        )}
      </div>

      {collections.length === 0 ? (
        <div {...stylex.props(shelfStyles.emptyPrompt)}>
          <span {...stylex.props(shelfStyles.emptyIcon)} aria-hidden="true">
            <Layers size={18} />
          </span>
          <div {...stylex.props(shelfStyles.emptyBody)}>
            <p {...stylex.props(shelfStyles.emptyTitle)}>No collections yet</p>
            <p {...stylex.props(shelfStyles.emptyText)}>
              Group related materials into a collection you can study in order.
            </p>
          </div>
          <Button
            label="Create Collection"
            variant="secondary"
            icon={<Plus size={16} />}
            onClick={onCreate}
          />
        </div>
      ) : virtualized ? (
        <VirtualShelfGrid collections={collections} counts={counts} onOpen={onOpen} />
      ) : (
        <div {...stylex.props(shelfStyles.grid)}>
          {visible.map((collection) => {
            const Icon = getCollectionIcon(collection.icon);
            const color = collection.color ?? 'var(--color-accent)';
            const count = counts[collection.id] ?? 0;
            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => onOpen(collection.id)}
                {...stylex.props(shelfStyles.card)}
                title={`Open collection: ${collection.title}`}
              >
                <span
                  {...stylex.props(shelfStyles.cardIcon)}
                  style={{
                    backgroundColor: `${collection.color ?? DEFAULT_COLLECTION_COLOR}12`,
                    border: `1px solid ${collection.color ?? DEFAULT_COLLECTION_COLOR}25`,
                    color,
                  }}
                  aria-hidden="true"
                >
                  <Icon size={18} />
                </span>
                <span {...stylex.props(shelfStyles.cardBody)}>
                  <span {...stylex.props(shelfStyles.cardTitle)}>{collection.title}</span>
                  <span {...stylex.props(shelfStyles.cardMeta)}>
                    {count} {count === 1 ? 'material' : 'materials'}
                  </span>
                </span>
                <span {...stylex.props(shelfStyles.chevron)} aria-hidden="true">
                  <ChevronRight size={18} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default CollectionShelf;
