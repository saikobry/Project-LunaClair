import {
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type TouchEvent,
} from 'react';
import * as stylex from '@stylexjs/stylex';
import { Plus, X } from 'lucide-react';
import { useModalDialog } from '../../../shared/hooks/useModalDialog';
import { styles } from './compactCollectionsPopover.stylex';
import { CollectionNavItem } from '../../../features/collections/components/CollectionNavItem';
import type { Collection } from '../../../domain/collections/models/Collection';

/** Anchored-panel geometry computed from the trigger's bounding rect. */
export interface PanelPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  maxHeight?: number | string;
}

export interface CollectionsPanelProps {
  collections: Collection[];
  counts: Record<string, number | undefined>;
  activeCollectionId?: string | null;
  onSelect: (collectionId: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

export interface CompactCollectionsRailPanelProps extends CollectionsPanelProps {
  panelRef: RefObject<HTMLDivElement | null>;
  position: PanelPosition;
}

/** Tablet: anchored side popover beside the rail trigger. */
export function CompactCollectionsRailPanel({
  panelRef,
  position,
  collections,
  counts,
  activeCollectionId,
  onSelect,
  onCreateNew,
  onClose,
}: CompactCollectionsRailPanelProps) {
  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Collections"
      tabIndex={-1}
      {...stylex.props(styles.panel)}
      style={position as CSSProperties}
    >
      <div {...stylex.props(styles.panelHeader)}>
        <span {...stylex.props(styles.panelHeaderLabel)}>Collections</span>
        <button
          type="button"
          aria-label="Close collections"
          title="Close"
          onClick={onClose}
          {...stylex.props(styles.trigger)}
          style={{ width: 32, height: 32, borderRadius: 10 }}
        >
          <X size={16} />
        </button>
      </div>

      <div {...stylex.props(styles.panelBody)}>
        {collections.length === 0 ? (
          <p {...stylex.props(styles.panelEmpty)}>
            No collections yet. Create your first collection to organize your materials.
          </p>
        ) : (
          collections.map((collection) => {
            const isRowActive = activeCollectionId === collection.id;
            const count = counts[collection.id] ?? 0;
            return (
              <CollectionNavItem
                key={collection.id}
                collection={collection}
                count={count}
                isActive={isRowActive}
                onSelect={() => onSelect(collection.id)}
                role="menuitem"
                iconSize={16}
                tintTarget="button"
                buttonProps={stylex.props(
                  styles.collectionRow,
                  isRowActive && styles.collectionRowActive,
                )}
                iconWrapProps={stylex.props(styles.collectionIcon)}
                labelProps={stylex.props(styles.collectionLabel)}
                badgeProps={stylex.props(styles.countBadge)}
              />
            );
          })
        )}
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={onCreateNew}
        {...stylex.props(styles.newCollectionRow)}
      >
        <Plus size={16} />
        New Collection
      </button>
    </div>
  );
}

const DRAG_DISMISS_THRESHOLD_PX = 60;

/**
 * Mobile: bottom drawer rendered as a native modal `<dialog>`.
 *
 * `showModal()` supplies the focus trap, Escape handling, `::backdrop`, and
 * top-layer stacking that the previous hand-rolled `role="dialog"` wrapper had
 * to fake. The drag-to-dismiss gesture and scroll lock are preserved.
 */
export function CompactCollectionsDockDrawer({
  collections,
  counts,
  activeCollectionId,
  onSelect,
  onCreateNew,
  onClose,
}: CollectionsPanelProps) {
  const touchStartY = useRef<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  // Native modal plumbing: open on mount plus backdrop dismissal (a native
  // modal delivers the backdrop click on the <dialog> element itself). Body
  // scroll locking for the dock placement is owned by `CompactCollectionsPopover`.
  const dialogRef = useModalDialog({ isOpen: true, onBackdropClick: onClose });

  const handleTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setDragOffsetY(delta);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > DRAG_DISMISS_THRESHOLD_PX) {
      onClose();
    } else {
      setDragOffsetY(0);
      touchStartY.current = null;
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Collections"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      {...stylex.props(styles.bottomDrawer)}
      style={
        dragOffsetY > 0
          ? { transform: `translateY(${dragOffsetY}px)`, transition: 'none' }
          : undefined
      }
    >
      <div
        {...stylex.props(styles.drawerHandleArea)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-hidden="true"
      >
        <div {...stylex.props(styles.drawerHandle)} />
      </div>

      <div
        {...stylex.props(styles.drawerHeader)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <h2 {...stylex.props(styles.drawerTitle)}>Collections</h2>
        <button
          type="button"
          aria-label="Close collections"
          title="Close"
          onClick={onClose}
          {...stylex.props(styles.drawerCloseButton)}
        >
          <X size={18} />
        </button>
      </div>

      <div {...stylex.props(styles.drawerBody)}>
        {collections.length === 0 ? (
          <p {...stylex.props(styles.drawerEmpty)}>
            No collections yet. Create your first collection to organize your materials.
          </p>
        ) : (
          collections.map((collection) => {
            const isRowActive = activeCollectionId === collection.id;
            const count = counts[collection.id] ?? 0;
            return (
              <CollectionNavItem
                key={collection.id}
                collection={collection}
                count={count}
                isActive={isRowActive}
                onSelect={() => onSelect(collection.id)}
                role="menuitem"
                iconSize={18}
                buttonProps={stylex.props(
                  styles.drawerRow,
                  isRowActive && styles.drawerRowActive,
                )}
                iconWrapProps={stylex.props(
                  styles.drawerRowIconWrapper,
                  isRowActive && styles.drawerRowIconWrapperActive,
                )}
                labelProps={stylex.props(styles.drawerRowLabel)}
                badgeProps={stylex.props(styles.countBadge)}
              />
            );
          })
        )}
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={onCreateNew}
        {...stylex.props(styles.drawerNewCollectionButton)}
      >
        <Plus size={18} />
        <span>New Collection</span>
      </button>
    </dialog>
  );
}
