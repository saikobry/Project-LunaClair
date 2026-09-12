import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as stylex from '@stylexjs/stylex';
import { Folder } from 'lucide-react';
import type { AppRoute } from '../../routing/routing';
import { styles } from './compactCollectionsPopover.stylex';
import {
  CompactCollectionsDockDrawer,
  CompactCollectionsRailPanel,
  type PanelPosition,
} from './CompactCollectionsPanel';
import { useCollections } from '../../../features/collections/hooks/queries/useCollections';
import { useCollectionMaterialCounts } from '../../../features/collections/hooks/queries/useCollectionMaterialCounts';
import { useCreateCollection } from '../../../features/collections/hooks/mutations/useCreateCollection';
import { CreateCollectionModal } from '../../../features/collections/modals/CreateCollectionModal';
import type { CreateCollectionInput } from '../../../domain/collections/models/Collection';

type PanelPlacement = 'rail' | 'dock';

export interface CompactCollectionsPopoverProps {
  /** Where the host lives — controls which edge the panel docks against. */
  placement: PanelPlacement;
  /** Active collection id — highlights the trigger and the matching row. */
  activeCollectionId?: string | null;
  onNavigate: (route: AppRoute) => void;
}

const PANEL_WIDTH = 256;
const PANEL_GAP = 10;
const MAX_PANEL_HEIGHT = 360;
const VIEWPORT_PADDING = 16;

/**
 * Compact collections discovery surface.
 *
 * Owns the trigger, open state, breakpoint dismissal, and the anchored-panel
 * geometry. The two presentation surfaces live in `CompactCollectionsPanel`:
 * a native modal `<dialog>` bottom drawer on mobile (`placement="dock"`) and an
 * anchored side popover on tablet (`placement="rail"`).
 */
export function CompactCollectionsPopover({
  placement,
  activeCollectionId,
  onNavigate,
}: CompactCollectionsPopoverProps) {
  const { collections } = useCollections();
  const { counts } = useCollectionMaterialCounts();
  const createMutation = useCreateCollection();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isActive = Boolean(activeCollectionId);

  // Recompute the panel position and height from the trigger rect for rail placement.
  // An Effect Event: it reads only refs and `placement`, so it must not resubscribe
  // the position/dismissal effects on every parent redraw.
  const computePosition = useEffectEvent(() => {
    if (placement !== 'rail') return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Vertical rail on the left: open the panel to the right of the trigger,
    // clamped horizontally to the viewport.
    const left = Math.max(
      8,
      Math.min(rect.right + PANEL_GAP, viewportWidth - PANEL_WIDTH - 8),
    );

    // Height & vertical positioning:
    // When the collections trigger is lower down in the rail (e.g. placed after Explore),
    // opening downward from rect.top might overflow the bottom viewport boundary.
    const panelHeight = panelRef.current?.offsetHeight || MAX_PANEL_HEIGHT;

    let top = rect.top;
    if (top + panelHeight > viewportHeight - VIEWPORT_PADDING) {
      // Shift the panel up so the bottom remains safely within the viewport padding
      top = Math.max(VIEWPORT_PADDING, viewportHeight - panelHeight - VIEWPORT_PADDING);
    } else {
      top = Math.max(VIEWPORT_PADDING, top);
    }

    const maxHeight = Math.min(
      MAX_PANEL_HEIGHT,
      Math.max(160, viewportHeight - top - VIEWPORT_PADDING),
    );

    setPosition({
      left,
      top,
      maxHeight,
    });
  });

  useLayoutEffect(() => {
    if (!isOpen) return;
    computePosition();
  }, [isOpen, placement, collections.length]);

  // Lock body scroll while mobile bottom drawer is open
  useEffect(() => {
    if (isOpen && placement === 'dock') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, placement]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Dismiss on Escape; reposition on resize/scroll while open; autohide if window crosses breakpoint.
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopover();
    };
    const handleResize = () => {
      // Auto-hide when resizing across viewport layout boundaries
      if (placement === 'dock' && window.innerWidth > 768) {
        closePopover();
        return;
      }
      if (
        placement === 'rail' &&
        (window.innerWidth < 769 || window.innerWidth > 1023)
      ) {
        closePopover();
        return;
      }
      computePosition();
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, placement, closePopover]);

  // Autohide when viewport changes across CSS media query breakpoints
  // (DesktopSidebar >=1024px, TabletRail 769-1023px, MobileBottomDock <=768px)
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window.matchMedia !== 'function') return;

    const query =
      placement === 'dock'
        ? '(max-width: 768px)'
        : '(min-width: 769px) and (max-width: 1023px)';

    const mql = window.matchMedia(query);

    const handleChange = (e: MediaQueryListEvent) => {
      if (!e.matches) {
        closePopover();
      }
    };

    if (mql.addEventListener) {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers / testing environments
      mql.addListener(handleChange);
      return () => mql.removeListener(handleChange);
    }
  }, [isOpen, placement, closePopover]);

  // Click-outside dismissal (ignore the trigger button itself). Only the rail
  // panel needs it — the dock placement is a modal `<dialog>`, so there is no
  // reachable "outside" to click.
  useEffect(() => {
    if (!isOpen || placement !== 'rail') return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      closePopover();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, placement, closePopover]);

  const handleCollectionClick = (collectionId: string) => {
    closePopover();
    onNavigate({ kind: 'collection', collectionId });
  };

  const handleNewCollectionSave = async (input: CreateCollectionInput) => {
    const created = await createMutation.mutateAsync(input);
    setIsCreateOpen(false);
    closePopover();
    onNavigate({ kind: 'collection', collectionId: created.id });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup={placement === 'dock' ? 'dialog' : 'menu'}
        aria-expanded={isOpen}
        aria-label="Collections"
        title="Collections"
        onClick={() => setIsOpen((prev) => !prev)}
        {...stylex.props(
          styles.trigger,
          placement === 'dock' && styles.triggerDock,
          isActive && styles.triggerActive,
        )}
      >
        <Folder size={20} />
      </button>

      {/*
       * Portalled so the fixed-positioned panel escapes the rail/dock
       * `overflow: hidden` + transformed containers.
       */}
      {isOpen &&
        createPortal(
          placement === 'dock' ? (
            <CompactCollectionsDockDrawer
              collections={collections}
              counts={counts}
              activeCollectionId={activeCollectionId}
              onSelect={handleCollectionClick}
              onCreateNew={() => {
                closePopover();
                setIsCreateOpen(true);
              }}
              onClose={closePopover}
            />
          ) : (
            <CompactCollectionsRailPanel
              panelRef={panelRef}
              position={position}
              collections={collections}
              counts={counts}
              activeCollectionId={activeCollectionId}
              onSelect={handleCollectionClick}
              onCreateNew={() => {
                closePopover();
                setIsCreateOpen(true);
              }}
              onClose={closePopover}
            />
          ),
          document.body,
        )}

      <CreateCollectionModal
        isOpen={isCreateOpen}
        onSave={handleNewCollectionSave}
        onClose={() => setIsCreateOpen(false)}
      />
    </>
  );
}
