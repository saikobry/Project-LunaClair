import { useRef, useEffect, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Plus } from 'lucide-react';
import gsap from 'gsap';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ViewportNavProps } from './navigation.types';
import { PRIMARY_NAV_ITEMS } from './navItems';
import { styles } from './desktopSidebar.stylex';
import { styles as appHeaderStyles } from '../appHeader.stylex';
import logoSvg from '../../../assets/logo.svg';
import { DesktopTrapezoidButton } from './DesktopTrapezoidButton';
import { useCollections } from '../../../features/collections/hooks/queries/useCollections';
import { useCollectionMaterialCounts } from '../../../features/collections/hooks/queries/useCollectionMaterialCounts';
import { useCreateCollection } from '../../../features/collections/hooks/mutations/useCreateCollection';
import { CreateCollectionModal } from '../../../features/collections/modals/CreateCollectionModal';
import { CollectionNavItem } from '../../../features/collections/components/CollectionNavItem';
import { Button } from '../../../shared/ui/Button/Button';
import { APP_VERSION } from '../../../shared/constants/appInfo';
import { VIRTUALIZE_AFTER_ITEM_COUNT } from '../../../shared/constants/listRendering';
import type { CreateCollectionInput } from '../../../domain/collections/models/Collection';
import type { Collection } from '../../../domain/collections/models/Collection';

/** Sidebar estimate: 20px vertical padding + one text/icon row. */
const ESTIMATED_NAV_ROW_HEIGHT = 40;

function CollectionNavButton({
  collection,
  count,
  isActive,
  onNavigate,
}: {
  collection: Collection;
  count: number;
  isActive: boolean;
  onNavigate: ViewportNavProps['onNavigate'];
}) {
  return (
    <CollectionNavItem
      collection={collection}
      count={count}
      isActive={isActive}
      onSelect={() => onNavigate({ kind: 'collection', collectionId: collection.id })}
      buttonProps={stylex.props(styles.navItem, isActive && styles.navItemActive)}
      iconWrapProps={stylex.props(styles.collectionIcon)}
      labelProps={stylex.props(styles.navLabel)}
      badgeProps={stylex.props(styles.countBadge)}
    />
  );
}

/**
 * Virtualized collection rows for large libraries (past
 * `VIRTUALIZE_AFTER_ITEM_COUNT`). Uniform single-column rows inside the
 * sidebar's own scroll pane — the plain path stays for small libraries.
 */
function VirtualCollectionsNavItems({
  collections,
  counts,
  activeCollectionId,
  onNavigate,
  getScrollElement,
}: {
  collections: Collection[];
  counts: Record<string, number>;
  activeCollectionId?: string | null;
  onNavigate: ViewportNavProps['onNavigate'];
  getScrollElement: () => HTMLElement | null;
}) {
  // eslint-disable-next-line react/incompatible-library -- `useVirtualizer` returns non-memoizable functions by design (upstream documented); the component takes no memoized inputs from it.
  const virtualizer = useVirtualizer({
    count: collections.length,
    getScrollElement,
    estimateSize: () => ESTIMATED_NAV_ROW_HEIGHT,
    overscan: 8,
    gap: 4,
  });

  return (
    <div
      style={{ position: 'relative', height: `${virtualizer.getTotalSize()}px`, width: '100%' }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const collection = collections[virtualRow.index];
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
            <CollectionNavButton
              collection={collection}
              count={counts[collection.id] ?? 0}
              isActive={activeCollectionId === collection.id}
              onNavigate={onNavigate}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Dynamic Collections section: browsable playlist nav items with a quick-add
 * button that opens `CreateCollectionModal` and navigates to the new
 * collection on save. Always visible — collection discovery is the point.
 */
function CollectionsNav({
  activeCollectionId,
  onNavigate,
}: {
  activeCollectionId?: string | null;
  onNavigate: ViewportNavProps['onNavigate'];
}) {
  const { collections } = useCollections();
  const { counts } = useCollectionMaterialCounts();
  const createMutation = useCreateCollection();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualized = collections.length > VIRTUALIZE_AFTER_ITEM_COUNT;

  const handleSave = async (input: CreateCollectionInput) => {
    const created = await createMutation.mutateAsync(input);
    setIsCreateOpen(false);
    onNavigate({ kind: 'collection', collectionId: created.id });
  };

  return (
    <div {...stylex.props(styles.collectionsScroll)} ref={scrollRef}>
      <div {...stylex.props(styles.navSection)}>
        <div {...stylex.props(styles.sectionHeader)}>
          <span {...stylex.props(styles.sectionLabel)}>Collections</span>
          <Button
            label="New Collection"
            tooltip="New Collection"
            isIconOnly
            variant="ghost"
            icon={<Plus size={16} />}
            onClick={() => setIsCreateOpen(true)}
          />
        </div>

        {virtualized ? (
          <VirtualCollectionsNavItems
            collections={collections}
            counts={counts}
            activeCollectionId={activeCollectionId}
            onNavigate={onNavigate}
            getScrollElement={() => scrollRef.current}
          />
        ) : (
          collections.map((collection) => (
            <CollectionNavButton
              key={collection.id}
              collection={collection}
              count={counts[collection.id] ?? 0}
              isActive={activeCollectionId === collection.id}
              onNavigate={onNavigate}
            />
          ))
        )}

        <CreateCollectionModal
          isOpen={isCreateOpen}
          onSave={handleSave}
          onClose={() => setIsCreateOpen(false)}
        />
      </div>
    </div>
  );
}

export function DesktopSidebar({
  active,
  isFocusMode,
  onToggleFocusMode,
  onNavigate,
  collectionId,
}: ViewportNavProps) {
  const containerRef = useRef<HTMLElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const didInitialFade = useRef(false);

  // ── GSAP: Upper navigation link & container background fade ──
  useEffect(() => {
    const links = linksRef.current;
    const container = containerRef.current;
    if (!links || !container) return;

    if (!didInitialFade.current) {
      didInitialFade.current = true;
      if (isFocusMode) {
        gsap.set(links, { autoAlpha: 0, pointerEvents: 'none' });
        gsap.set(container, { backgroundColor: 'transparent', borderColor: 'transparent' });
      } else {
        gsap.set(links, { autoAlpha: 1, pointerEvents: 'auto' });
        gsap.set(container, { clearProps: 'backgroundColor,borderColor' });
      }
      return;
    }

    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

    if (isFocusMode) {
      tl.to(links, {
        autoAlpha: 0,
        y: 16,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(links, { pointerEvents: 'none' });
        },
      }, 0);

      tl.to(container, {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        duration: 0.24,
      }, 0.04);
    } else {
      tl.to(container, {
        backgroundColor: 'var(--color-background-surface)',
        borderColor: 'var(--color-border)',
        duration: 0.28,
        ease: 'power2.out',
      }, 0);

      gsap.set(links, { pointerEvents: 'auto' });
      tl.fromTo(links,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.24, ease: 'power2.out' },
        0.12
      );
    }
  }, [isFocusMode]);

  return (
    <nav
      ref={containerRef}
      {...stylex.props(styles.desktopNav)}
      aria-label="Desktop Navigation"
    >
      <div ref={linksRef} {...stylex.props(styles.linksWrapper)}>
        {/* Brand lockup: the desktop home for the header's logo + name +
            version (the header keeps them on mobile only). Static mark. */}
        <div data-brand-source="sidebar" {...stylex.props(styles.brandButton)}>
          <img src={logoSvg} alt="" aria-hidden="true" data-brand-logo="sidebar" {...stylex.props(appHeaderStyles.logo, styles.brandImg, isFocusMode && styles.brandImgHidden)} />
          <span {...stylex.props(appHeaderStyles.title)}>Project LunaClair</span>
          <span {...stylex.props(appHeaderStyles.versionBadge)}>{APP_VERSION}</span>
        </div>
        <div {...stylex.props(styles.navSection)}>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = item.isActive(active);
            return (
              <button
                key={item.id}
                type="button"
                {...stylex.props(styles.navItem, isActive && styles.navItemActive)}
                onClick={() => onNavigate(item.route)}
                aria-current={isActive ? 'page' : undefined}
                title={item.title}
              >
                <item.icon size={18} />
                <span {...stylex.props(styles.navLabel)}>{item.label}</span>
              </button>
            );
          })}

        </div>

        <div {...stylex.props(styles.divider)} aria-hidden="true" />

        {/* Independent scroll pane: collections grow here while the links above
            and the trapezoid footer below stay pinned. */}
        <CollectionsNav
          activeCollectionId={collectionId}
          onNavigate={onNavigate}
        />
      </div>

      {/* Connected Option A Rounded Trapezoid Drawer Button */}
      <DesktopTrapezoidButton
        isFocusMode={isFocusMode}
        onToggleFocusMode={onToggleFocusMode}
      />
    </nav>
  );
}
