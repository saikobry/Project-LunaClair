import * as stylex from '@stylexjs/stylex';
import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { Collection } from '../../../domain/collections/models/Collection';
import { getCollectionIcon } from '../modals/collectionAppearance';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { shelfStyles } from './collectionShelf.stylex';

/** Shelf estimate: 14px vertical padding pair + 40px icon row + borders. */
const ESTIMATED_ROW_HEIGHT = 70;

export interface VirtualShelfGridProps {
  collections: Collection[];
  /** Per-collection member counts (`collectionId -> count`). */
  counts: Record<string, number>;
  onOpen: (collectionId: string) => void;
}

/**
 * Window-virtualized collections grid for large libraries (past
 * `VIRTUALIZE_AFTER_ITEM_COUNT`). Renders aligned rows in chunks of the live
 * lane count — the same 1/2/3 columns the CSS grid uses at its breakpoints —
 * and measures each row so variable fonts/zoom stay correct.
 *
 * Card markup is identical to the plain grid path; only the positioning
 * wrapper differs, so small libraries never pay for this.
 */
export function VirtualShelfGrid({ collections, counts, onOpen }: VirtualShelfGridProps) {
  const isTablet = useMediaQuery('(min-width: 641px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const lanes = isDesktop ? 3 : isTablet ? 2 : 1;

  const rowCount = Math.max(1, Math.ceil(collections.length / lanes));

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 4,
    gap: 12,
  });

  // Lane regrouping reuses index-keyed rows — drop cached heights so rows
  // re-measure instead of keeping a stale sibling's size.
  useEffect(() => {
    virtualizer.measure();
  }, [lanes, virtualizer]);

  return (
    <div
      style={{ position: 'relative', height: `${virtualizer.getTotalSize()}px`, width: '100%' }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const rowCollections = collections.slice(
          virtualRow.index * lanes,
          virtualRow.index * lanes + lanes,
        );
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${lanes}, minmax(0, 1fr))`,
                gap: 12,
              }}
            >
              {rowCollections.map((collection) => {
                const Icon = getCollectionIcon(collection.icon);
                const color = collection.color ?? 'var(--color-accent)';
                const count = counts[collection.id] ?? 0;
                return (
                  <div key={collection.id} style={{ minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => onOpen(collection.id)}
                      {...stylex.props(shelfStyles.card)}
                      title={`Open collection: ${collection.title}`}
                    >
                      <span
                        {...stylex.props(shelfStyles.cardIcon)}
                        style={{
                          backgroundColor: `${collection.color ?? '#a78bfa'}12`,
                          border: `1px solid ${collection.color ?? '#a78bfa'}25`,
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
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
