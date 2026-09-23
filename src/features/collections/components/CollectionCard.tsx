import * as stylex from '@stylexjs/stylex';
import { ChevronRight } from 'lucide-react';
import { DEFAULT_COLLECTION_COLOR, type Collection } from '../../../domain/collections/models/Collection';
import { getCollectionIcon } from '../modals/collectionAppearance';
import { shelfStyles } from './collectionShelf.stylex';

export interface CollectionCardProps {
  collection: Collection;
  /** Member count for this collection. */
  count: number;
  onOpen: (collectionId: string) => void;
}

/**
 * Single collection playlist card (icon + color, title, member count, chevron).
 *
 * Pure presentation on `collectionShelf.stylex.ts`: callers resolve the count
 * and pass it in, so this component stays fast-refresh-clean and independently
 * testable. Shared by the plain `CollectionShelf` grid and the virtualized
 * `VirtualShelfGrid` path — markup is identical, only the positioning wrapper
 * differs.
 */
export function CollectionCard({ collection, count, onOpen }: CollectionCardProps) {
  const Icon = getCollectionIcon(collection.icon);
  const color = collection.color ?? 'var(--color-accent)';
  return (
    <button
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
        {/* eslint-disable-next-line react/static-components -- `Icon` is a stable registry lookup from above, not a render-created component. */}
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
}

export default CollectionCard;
