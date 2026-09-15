import { type CSSProperties, type KeyboardEvent, type MouseEvent, type RefObject, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit, ClipboardList, FolderPlus, Plus, X, Check, Folder, SquarePen, Trash2 } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { DEFAULT_COLLECTION_COLOR, type Collection } from '../../../domain/collections/models/Collection';
import { Card } from '../../../shared/ui/Card/Card';
import { IconButton } from '../../../shared/ui/IconButton/IconButton';
import { Chip } from '../../../shared/ui/Chip/Chip';
import { cardStyles } from './materialCard.stylex';
import { ActionMenu } from '../../../shared/components/ActionMenu/ActionMenu';
import { ActionMenuItem } from '../../../shared/components/ActionMenu/ActionMenuItem';

import { useMaterialCollections } from '../../../features/collections/hooks/queries/useMaterialCollections';
import { useCollections } from '../../../features/collections/hooks/queries/useCollections';
import { useAddMaterialToCollection } from '../../../features/collections/hooks/mutations/useAddMaterialToCollection';
import { useRemoveMaterialFromCollection } from '../../../features/collections/hooks/mutations/useRemoveMaterialFromCollection';
import { useToast } from '../../../app/providers/ToastContext';

export interface MaterialCardProps {
  material: StudyMaterial;
  onOpen: (material: StudyMaterial) => void;
  onEdit?: (material: StudyMaterial) => void;
  onDelete?: (material: StudyMaterial) => void;
  onStartQuiz?: (material: StudyMaterial) => void;
  onManage?: (material: StudyMaterial) => void;
  onNavigate?: (collectionId: string) => void;
  /** Tag-filter toggle (library only) — card tags join the filter when present. */
  onToggleTag?: (tag: string) => void;
  /** Currently selected filter tags (drives the card tag pressed state). */
  selectedTags?: string[];
}

/** Compact "last opened" label for the card footer (prototype mental model:
 * clock + relative time, no `Last opened:` prefix). */
function formatDate(iso: string | undefined): string {
  if (!iso) return 'Never opened';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface MaterialCollectionsPopoverProps {
  popoverRef: RefObject<HTMLDivElement | null>;
  collections: Collection[];
  memberCollectionIds: Set<string>;
  /** Collections whose toggle mutation is currently in flight. */
  pendingCollectionIds: ReadonlySet<string>;
  onToggle: (collection: Collection) => void;
  onClose: () => void;
  /** Surface style override (the portal host supplies positioning inline). */
  xstyle?: stylex.StyleXStyles;
  style?: CSSProperties;
}

/**
 * Shared popover chrome: title row with close button plus subtitle.
 * Extracted so the filing and all-tags popovers cannot drift apart.
 */
function PopoverHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <div {...stylex.props(cardStyles.popoverHeader)}>
      <div {...stylex.props(cardStyles.popoverHeaderRow)}>
        <span {...stylex.props(cardStyles.popoverTitle)}>{title}</span>
        <IconButton
          label="Close popover"
          icon={<X size={14} />}
          variant="ghost"
          size="sm"
          onClick={onClose}
        />
      </div>
      <p {...stylex.props(cardStyles.popoverSubtitle)}>{subtitle}</p>
    </div>
  );
}

/**
 * Inline collection-assignment popover. One real <button> per collection row.
 *
 * Stays open across toggles so a material can be filed into several collections
 * in one pass, and dims each row while its mutation is in flight.
 */
function MaterialCollectionsPopover({
  popoverRef,
  collections,
  memberCollectionIds,
  pendingCollectionIds,
  onToggle,
  onClose,
  xstyle,
  style,
}: MaterialCollectionsPopoverProps) {
  return (
    <div ref={popoverRef} {...stylex.props(cardStyles.popover, xstyle)} style={style}>
      <PopoverHeader
        title="Add to collections"
        subtitle="One material. As many collections as you like."
        onClose={onClose}
      />
      <div role="group" aria-label="Collections" {...stylex.props(cardStyles.popoverList)}>
        {collections.length === 0 ? (
          <p {...stylex.props(cardStyles.popoverEmpty)}>
            No collections yet. Create one from the Library, then come back here.
          </p>
        ) : (
          collections.map((collection) => {
            const isInCollection = memberCollectionIds.has(collection.id);
            const isPending = pendingCollectionIds.has(collection.id);
            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => onToggle(collection)}
                disabled={isPending}
                aria-busy={isPending}
                {...stylex.props(
                  cardStyles.popoverRow,
                  isPending && cardStyles.popoverRowPending,
                )}
              >
                <div
                  {...stylex.props(cardStyles.popoverIcon)}
                  style={{
                    backgroundColor: `${collection.color ?? DEFAULT_COLLECTION_COLOR}12`,
                    borderColor: `${collection.color ?? DEFAULT_COLLECTION_COLOR}25`,
                    color: collection.color ?? DEFAULT_COLLECTION_COLOR,
                  }}
                >
                  <Folder size={14} />
                </div>
                <span {...stylex.props(cardStyles.popoverRowLabel)}>
                  {collection.title}
                </span>
                {isInCollection ? (
                  <span {...stylex.props(cardStyles.popoverCheck)}>
                    <Check size={16} />
                  </span>
                ) : (
                  <span {...stylex.props(cardStyles.popoverPlus)}>
                    <Plus size={16} />
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

interface MaterialCollectionBadgesProps {
  collections: Collection[];
  onNavigate?: (collectionId: string) => void;
  /** Opens the filing popover (the `+N` overflow pill). */
  onOverflowOpen?: () => void;
  overflowOpen?: boolean;
}

/** Fallback badge count when the row cannot be measured (tests, hidden trees). */
const BADGE_FALLBACK_COUNT = 2;

/** Collection membership badges, or the "not filed yet" hint. Badge clicks
 * stop at the card — the shell opens on body clicks, badges navigate. */
function MaterialCollectionBadges({
  collections,
  onNavigate,
  onOverflowOpen,
  overflowOpen,
}: MaterialCollectionBadgesProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const fit = useFittedCount(rowRef, probeRef, collections.length, BADGE_FALLBACK_COUNT);

  if (collections.length === 0) {
    return (
      <div {...stylex.props(cardStyles.membershipSection)}>
        <div {...stylex.props(cardStyles.membershipEmpty)}>
          <BookOpen size={12} />
          <span>Not in a collection yet</span>
        </div>
      </div>
    );
  }

  const overflow = collections.length - fit;

  return (
    <div {...stylex.props(cardStyles.membershipSection)}>
      <div ref={rowRef} {...stylex.props(cardStyles.badgeRow)}>
        {collections.slice(0, fit).map((collection) => (
          <button
            key={collection.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate?.(collection.id);
            }}
            {...stylex.props(
              cardStyles.badgeButton,
              onNavigate ? cardStyles.badgeButtonClickable : cardStyles.badgeButtonStatic,
            )}
            style={{
              backgroundColor: `${collection.color ?? DEFAULT_COLLECTION_COLOR}12`,
              borderColor: `${collection.color ?? DEFAULT_COLLECTION_COLOR}25`,
              color: collection.color ?? DEFAULT_COLLECTION_COLOR,
            }}
          >
            <Folder size={10} />
            <span {...stylex.props(cardStyles.badgeLabel)}>
              {collection.title}
            </span>
          </button>
        ))}
        {overflow > 0 && (
          <button
            key="overflow"
            type="button"
            title={`${collections.length} collections assigned`}
            aria-expanded={overflowOpen}
            aria-haspopup="dialog"
            {...stylex.props(cardStyles.badgeButton, cardStyles.badgeOverflow)}
            onClick={(e) => {
              e.stopPropagation();
              onOverflowOpen?.();
            }}
          >
            +{overflow}
          </button>
        )}
      </div>
      {/* Width probe — same badges, never painted or interactive. */}
      <div aria-hidden="true" ref={probeRef} {...stylex.props(cardStyles.measurer)}>
        {collections.map((collection) => (
          <button
            key={collection.id}
            type="button"
            disabled
            tabIndex={-1}
            {...stylex.props(cardStyles.badgeButton)}
          >
            <Folder size={10} />
            <span {...stylex.props(cardStyles.badgeLabel)}>
              {collection.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Fixed viewport coords for a portaled popover: `anchorRef` supplies the
 * top/bottom edge (trigger or row), `alignRef` supplies the left edge + width
 * (the card shell, so the panel reads as an attached sheet). Flips upward
 * when the viewport below the anchor cannot fit the panel. Measured on the
 * opening event (the portal adds no layout itself); the effect only re-syncs
 * on scroll/resize while open. */
function usePopoverPosition(
  anchorRef: RefObject<Element | null>,
  alignRef: RefObject<Element | null>,
  isOpen: boolean,
) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  const update = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const align = alignRef.current?.getBoundingClientRect();
    const width = Math.max(
      280,
      Math.min(360, align ? align.right - align.left : 320),
    );
    const alignLeft = align ? align.left : anchor.right - width;
    const left = Math.max(8, Math.min(alignLeft, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - anchor.bottom;
    if (spaceBelow < 400 && anchor.top > spaceBelow) {
      setPos({ bottom: Math.max(8, window.innerHeight - anchor.top + 6), left });
    } else {
      setPos({ top: anchor.bottom + 6, left });
    }
  }, [anchorRef, alignRef]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen, update]);

  const clear = useCallback(() => {
    setPos(null);
  }, []);
  return { pos, update, clear };
}

/** Width reserved for the `+N` overflow pill when every item cannot fit. */
const OVERFLOW_RESERVE = 52;
/** Must match the `tagsRow` / `badgeRow` gap above. */
const ROW_GAP = 6;

/**
 * Width-fitted row count: measures one hidden probe row plus the visible
 * container, then reports how many leading items fit (overflow pill reserved).
 * Rows overflow only when they hit the width limit — never a fixed cap.
 * Unmeasurable containers (tests, hidden subtrees) fall back to `fallback`.
 */
function useFittedCount(
  rowRef: RefObject<HTMLDivElement | null>,
  probeRef: RefObject<HTMLDivElement | null>,
  count: number,
  fallback: number,
): number {
  const [fit, setFit] = useState(() => Math.min(count, fallback));

  useEffect(() => {
    const row = rowRef.current;
    const probe = probeRef.current;
    if (!row || !probe) return;
    const compute = () => {
      const avail = row.clientWidth;
      if (avail <= 0) {
        setFit(Math.min(count, fallback));
        return;
      }
      const widths = Array.from(probe.children).map(
        (kid) => (kid as HTMLElement).offsetWidth,
      );
      const total = widths.reduce((sum, w, i) => sum + w + (i > 0 ? ROW_GAP : 0), 0);
      if (total <= avail) {
        setFit(count);
        return;
      }
      let used = 0;
      let n = 0;
      for (const w of widths) {
        const step = w + (n > 0 ? ROW_GAP : 0);
        if (used + step + OVERFLOW_RESERVE <= avail) {
          used += step;
          n += 1;
        } else {
          break;
        }
      }
      // Never strand a row as a lone `+N`: when nothing fits beside the
      // reserved pill, keep the first item so its identity stays visible
      // (a single item then shows alone with no overflow pill).
      setFit(count === 0 ? 0 : Math.max(1, n));
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(row);
    if (document.fonts) {
      document.fonts.ready.then(compute).catch(() => undefined);
    }
    return () => observer.disconnect();
  }, [rowRef, probeRef, count, fallback]);

  return fit;
}

interface MaterialTagPillProps {
  tag: string;
  selected?: boolean;
  /** When present, the pill toggles; otherwise it renders as a static chip. */
  onToggle?: (tag: string) => void;
}

/** One tag pill — the single source for the row and the overflow viewer. */
function MaterialTagPill({ tag, selected, onToggle }: MaterialTagPillProps) {
  if (!onToggle) {
    return (
      <Chip key={tag} variant="neutral" style={cardStyles.tagChip}>
        #{tag}
      </Chip>
    );
  }
  return (
    <button
      key={tag}
      type="button"
      aria-pressed={selected}
      {...stylex.props(cardStyles.tagButton, selected && cardStyles.tagButtonActive)}
      onClick={() => onToggle(tag)}
    >
      #{tag}
    </button>
  );
}

interface MaterialTagRowProps {
  tags: string[];
  selectedTags?: string[];
  /** When present, tags render as filter toggles; otherwise static chips. */
  onToggleTag?: (tag: string) => void;
  /** Tag-row anchor for measurement and the overflow popover. */
  rowRef: RefObject<HTMLDivElement | null>;
  /** Opens the overflow popover (the `+N` pill). */
  onOverflowOpen?: () => void;
  overflowOpen?: boolean;
}

/** Fallback tag count when the row cannot be measured (tests, hidden trees). */
const TAG_FALLBACK_COUNT = 3;

/** Card tags — filter toggles in the library, static chips elsewhere. */
function MaterialTagRow({ tags, selectedTags, onToggleTag, rowRef, onOverflowOpen, overflowOpen }: MaterialTagRowProps) {
  const selectedTagSet = useMemo(() => new Set(selectedTags ?? []), [selectedTags]);
  const probeRef = useRef<HTMLDivElement>(null);
  const fit = useFittedCount(rowRef, probeRef, tags.length, TAG_FALLBACK_COUNT);
  const overflow = tags.length - fit;
  const hiddenSelected =
    overflow > 0 && tags.slice(fit).some((t) => selectedTagSet.has(t));
  return (
    <div ref={rowRef} {...stylex.props(cardStyles.tagsRow)}>
      {tags.slice(0, fit).map((tag) => (
        <MaterialTagPill
          key={tag}
          tag={tag}
          selected={selectedTagSet.has(tag)}
          onToggle={onToggleTag}
        />
      ))}
      {overflow > 0 && (
        <button
          key="overflow"
          type="button"
          title={`${overflow} more tags`}
          aria-expanded={overflowOpen}
          aria-haspopup="dialog"
          aria-pressed={hiddenSelected}
          {...stylex.props(cardStyles.tagButton, hiddenSelected && cardStyles.tagButtonActive)}
          onClick={(e) => {
            e.stopPropagation();
            onOverflowOpen?.();
          }}
        >
          +{overflow}
        </button>
      )}
      {/* Width probe — same pills, never painted or interactive. */}
      <div aria-hidden="true" ref={probeRef} {...stylex.props(cardStyles.measurer)}>
        {tags.map((tag) => (
          <button key={tag} type="button" disabled tabIndex={-1} {...stylex.props(cardStyles.tagButton)}>
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
}

interface MaterialTagsPopoverProps {
  popoverRef: RefObject<HTMLDivElement | null>;
  tags: string[];
  selectedTags?: string[];
  onToggleTag?: (tag: string) => void;
  onClose: () => void;
  xstyle?: stylex.StyleXStyles;
  style?: CSSProperties;
}

/**
 * Overflow tag viewer — every tag on the material as clickable pills.
 * A neutral expansion surface, not a filter panel: pills behave exactly like
 * the row pills and the popover stays open across toggles.
 */
function MaterialTagsPopover({
  popoverRef,
  tags,
  selectedTags,
  onToggleTag,
  onClose,
  xstyle,
  style,
}: MaterialTagsPopoverProps) {
  const selectedTagSet = useMemo(() => new Set(selectedTags ?? []), [selectedTags]);
  return (
    <div ref={popoverRef} {...stylex.props(cardStyles.popover, xstyle)} style={style}>
      <PopoverHeader
        title="All tags"
        subtitle="Every tag on this material."
        onClose={onClose}
      />
      <div role="group" aria-label="Tags" {...stylex.props(cardStyles.popoverList)}>
        <div {...stylex.props(cardStyles.popoverTags)}>
          {tags.map((tag) => (
            <MaterialTagPill
              key={tag}
              tag={tag}
              selected={selectedTagSet.has(tag)}
              onToggle={onToggleTag}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface MaterialCardFooterProps {
  material: StudyMaterial;
  onStartQuiz?: (material: StudyMaterial) => void;
}

/** Bordered-top footer (prototype direction): recency left, Quiz action right. */
function MaterialCardFooter({ material, onStartQuiz }: MaterialCardFooterProps) {
  return (
    <div {...stylex.props(cardStyles.footer)}>
      <div {...stylex.props(cardStyles.metaRow)} title={`Last opened: ${formatDate(material.lastOpenedAt)}`}>
        <BookOpen size={12} aria-hidden="true" />
        <span>{formatDate(material.lastOpenedAt)}</span>
      </div>
      {onStartQuiz && (
        <button
          type="button"
          aria-label={`Start quiz for ${material.title}`}
          {...stylex.props(cardStyles.quizButton)}
          onClick={(e) => {
            e.stopPropagation();
            onStartQuiz(material);
          }}
        >
          <BrainCircuit size={12} aria-hidden="true" />
          Quiz
        </button>
      )}
    </div>
  );
}

interface CardOverlays {
  shellRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  popoverRef: RefObject<HTMLDivElement | null>;
  tagsRowRef: RefObject<HTMLDivElement | null>;
  tagsPopoverRef: RefObject<HTMLDivElement | null>;
  isPopoverOpen: boolean;
  isTagsOpen: boolean;
  popoverPos: { top?: number; bottom?: number; left: number } | null;
  tagsPos: { top?: number; bottom?: number; left: number } | null;
  openCollections: () => void;
  openTags: () => void;
  handleTogglePopover: (e: MouseEvent<HTMLButtonElement>) => void;
  handleToggleTags: () => void;
  closeAll: () => void;
}

/**
 * Both card popovers (filing + all-tags) as one decision cluster: open state,
 * portaled positions, exclusive opening, and shared dismissal. Extracted so
 * `MaterialCard` stays a composer.
 */
function useCardOverlays(): CardOverlays {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const tagsRowRef = useRef<HTMLDivElement>(null);
  const tagsPopoverRef = useRef<HTMLDivElement>(null);
  const { pos: popoverPos, update: updatePopoverPos, clear: clearPopoverPos } =
    usePopoverPosition(triggerRef, shellRef, isPopoverOpen);
  const { pos: tagsPos, update: updateTagsPos, clear: clearTagsPos } =
    usePopoverPosition(tagsRowRef, shellRef, isTagsOpen);

  const openCollections = useCallback(() => {
    setIsTagsOpen(false);
    clearTagsPos();
    updatePopoverPos();
    setIsPopoverOpen(true);
  }, [updatePopoverPos, clearTagsPos]);

  const openTags = useCallback(() => {
    setIsPopoverOpen(false);
    clearPopoverPos();
    updateTagsPos();
    setIsTagsOpen(true);
  }, [updateTagsPos, clearPopoverPos]);

  const closeAll = useCallback(() => {
    setIsPopoverOpen(false);
    setIsTagsOpen(false);
  }, []);

  const handleTogglePopover = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (isPopoverOpen) {
        setIsPopoverOpen(false);
        clearPopoverPos();
      } else {
        // Measure on the opening event (the portal adds no layout itself),
        // so no effect-driven setState is needed for the initial position.
        openCollections();
      }
    },
    [isPopoverOpen, openCollections, clearPopoverPos],
  );

  const handleToggleTags = useCallback(() => {
    if (isTagsOpen) {
      setIsTagsOpen(false);
      clearTagsPos();
    } else {
      openTags();
    }
  }, [isTagsOpen, openTags, clearTagsPos]);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        setIsPopoverOpen(false);
      }
      if (tagsRowRef.current?.contains(target)) return;
      if (tagsPopoverRef.current && !tagsPopoverRef.current.contains(target)) {
        setIsTagsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: Event) => {
      const keyboardEvent = event as unknown as KeyboardEvent;
      if (keyboardEvent.key === 'Escape' && (isPopoverOpen || isTagsOpen)) {
        closeAll();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isPopoverOpen, isTagsOpen, closeAll]);

  return {
    shellRef,
    triggerRef,
    popoverRef,
    tagsRowRef,
    tagsPopoverRef,
    isPopoverOpen,
    isTagsOpen,
    popoverPos,
    tagsPos,
    openCollections,
    openTags,
    handleTogglePopover,
    handleToggleTags,
    closeAll,
  };
}

interface CollectionsPortalProps {
  open: boolean;
  pos: { top?: number; bottom?: number; left: number } | null;
  popoverRef: RefObject<HTMLDivElement | null>;
  collections: Collection[];
  memberCollectionIds: Set<string>;
  pendingCollectionIds: ReadonlySet<string>;
  onToggle: (collection: Collection) => void;
  onClose: () => void;
}

/** Portaled filing popover — null until open and measured. */
function CollectionsPortal({
  open,
  pos,
  popoverRef,
  collections,
  memberCollectionIds,
  pendingCollectionIds,
  onToggle,
  onClose,
}: CollectionsPortalProps) {
  if (!open || !pos) return null;
  return createPortal(
    <MaterialCollectionsPopover
      popoverRef={popoverRef}
      collections={collections}
      memberCollectionIds={memberCollectionIds}
      pendingCollectionIds={pendingCollectionIds}
      onToggle={onToggle}
      onClose={onClose}
      xstyle={cardStyles.popover}
      style={{ position: 'fixed', zIndex: 200, width: 320, ...pos }}
    />,
    document.body,
  );
}

interface TagsPortalProps {
  open: boolean;
  pos: { top?: number; bottom?: number; left: number } | null;
  popoverRef: RefObject<HTMLDivElement | null>;
  tags: string[];
  selectedTags?: string[];
  onToggleTag?: (tag: string) => void;
  onClose: () => void;
}

/** Portaled all-tags viewer — null until open and measured. */
function TagsPortal({
  open,
  pos,
  popoverRef,
  tags,
  selectedTags,
  onToggleTag,
  onClose,
}: TagsPortalProps) {
  if (!open || !pos) return null;
  return createPortal(
    <MaterialTagsPopover
      popoverRef={popoverRef}
      tags={tags}
      selectedTags={selectedTags}
      onToggleTag={onToggleTag}
      onClose={onClose}
      xstyle={cardStyles.popover}
      style={{ position: 'fixed', zIndex: 200, width: 320, ...pos }}
    />,
    document.body,
  );
}

export function MaterialCard({
  material,
  onOpen,
  onEdit,
  onDelete,
  onStartQuiz,
  onManage,
  onNavigate,
  onToggleTag,
  selectedTags,
}: MaterialCardProps) {
  const { collections: memberCollections } = useMaterialCollections(material.id);
  const { collections: allCollections } = useCollections();
  const addMutation = useAddMaterialToCollection();
  const removeMutation = useRemoveMaterialFromCollection();
  const { showToast } = useToast();

  const [pendingCollectionIds, setPendingCollectionIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const {
    shellRef,
    triggerRef,
    popoverRef,
    tagsRowRef,
    tagsPopoverRef,
    isPopoverOpen,
    isTagsOpen,
    popoverPos,
    tagsPos,
    openCollections,
    handleTogglePopover,
    handleToggleTags,
    closeAll,
  } = useCardOverlays();

  // Membership is re-checked per popover row and per badge, so resolve it once
  // per render instead of scanning the list each time.
  const memberCollectionIds = useMemo(
    () => new Set(memberCollections.map((c) => c.id)),
    [memberCollections],
  );

  const handleCollectionToggle = useCallback(
    async (collection: Collection) => {
      const isInCollection = memberCollectionIds.has(collection.id);
      setPendingCollectionIds((prev) => new Set(prev).add(collection.id));

      try {
        if (isInCollection) {
          await removeMutation.mutateAsync({ collectionId: collection.id, materialId: material.id });
          showToast(`Removed from ${collection.title}`, { intent: 'info' });
        } else {
          await addMutation.mutateAsync({ collectionId: collection.id, materialId: material.id });
          showToast(`Added to ${collection.title}`, { intent: 'success' });
        }
      } catch {
        // The mutation hook's onError already surfaced the failure toast.
      } finally {
        setPendingCollectionIds((prev) => {
          const next = new Set(prev);
          next.delete(collection.id);
          return next;
        });
      }
      // Deliberately does NOT close the popover — filing one material into
      // several collections should not require re-opening it each time.
    },
    [memberCollectionIds, addMutation, removeMutation, material.id, showToast],
  );

  /**
   * Whole-card pointer affordance (prototype direction): body clicks open the
   * material. Inner controls are all real `<button>`/`<input>` elements that
   * stop propagation themselves — the `closest` guard below is the backstop so
   * a missed stop can never double-fire. Deliberately no `role="button"` on
   * the shell: nested buttons inside a button role is invalid ARIA. Keyboard
   * and AT users open via the title button (and the menu's Open item).
   */
  const handleCardOpen = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (popoverRef.current?.contains(target)) return;
    if (tagsPopoverRef.current?.contains(target)) return;
    if (
      target.closest(
        'button, a, input, textarea, select, [role="menu"], [role="dialog"]',
      )
    )
      return;
    onOpen(material);
  };

  return (
    <Card xstyle={cardStyles.cardHoverBorder}>
      <div
        ref={shellRef}
        {...stylex.props(cardStyles.interactive, cardStyles.clickableArea)}
        onClick={handleCardOpen}
      >
        {/* Header: Title + Actions (filing lives with the playlists below) */}
        <div {...stylex.props(cardStyles.header)}>
          <div {...stylex.props(cardStyles.titleColumn)}>
            <h3 {...stylex.props(cardStyles.title)}>
              <button
                type="button"
                onClick={() => onOpen(material)}
                title={`Open ${material.title}`}
                {...stylex.props(cardStyles.titleButton)}
              >
                {material.title}
              </button>
            </h3>
          </div>
          <div {...stylex.props(cardStyles.headerActions)}>
            {(onEdit || onDelete) && (
              <ActionMenu>
                <ActionMenuItem
                  icon={<BookOpen size={14} />}
                  label="Open"
                  description="Open this material"
                  onClick={() => onOpen(material)}
                />
                {onStartQuiz && (
                  <ActionMenuItem
                    icon={<BrainCircuit size={14} />}
                    label="Start quiz"
                    description="Launch a practice run"
                    onClick={() => onStartQuiz(material)}
                  />
                )}
                {onManage && (
                  <ActionMenuItem
                    icon={<ClipboardList size={14} />}
                    label="Manage questions"
                    description="Bank, flashcards and edits"
                    onClick={() => onManage(material)}
                  />
                )}
                <ActionMenuItem
                  icon={<FolderPlus size={14} />}
                  label="Organize"
                  description="Add or remove collections"
                  onClick={openCollections}
                />
                {onEdit && (
                  <ActionMenuItem
                    icon={<SquarePen size={14} />}
                    label="Edit"
                    description="Modify this material"
                    onClick={() => onEdit(material)}
                  />
                )}
                {onDelete && (
                  <ActionMenuItem
                    icon={<Trash2 size={14} />}
                    label="Delete"
                    description="This action cannot be undone"
                    onClick={() => onDelete(material)}
                  />
                )}
              </ActionMenu>
            )}
          </div>
        </div>

        {/* Description */}
        {material.description && (
          <p {...stylex.props(cardStyles.description)}>{material.description}</p>
        )}

        {/* Tags — toggle buttons when the library filter is wired, static chips elsewhere */}
        {material.tags && material.tags.length > 0 && (
          <MaterialTagRow
            tags={material.tags}
            selectedTags={selectedTags}
            onToggleTag={onToggleTag}
            rowRef={tagsRowRef}
            onOverflowOpen={handleToggleTags}
            overflowOpen={isTagsOpen}
          />
        )}

        <TagsPortal
          open={isTagsOpen}
          pos={tagsPos}
          popoverRef={tagsPopoverRef}
          tags={material.tags ?? []}
          selectedTags={selectedTags}
          onToggleTag={onToggleTag}
          onClose={closeAll}
        />

        {/* Collection Membership + Assignment (filing lives with the playlists) */}
        <div {...stylex.props(cardStyles.membershipRow)}>
          <div {...stylex.props(cardStyles.membershipBadges)}>
            <MaterialCollectionBadges
              collections={memberCollections}
              onNavigate={onNavigate}
              onOverflowOpen={openCollections}
              overflowOpen={isPopoverOpen}
            />
          </div>
          <IconButton
            label={isPopoverOpen ? `Close collections for ${material.title}` : `Add ${material.title} to collections`}
            icon={<FolderPlus size={16} />}
            variant="ghost"
            size="sm"
            aria-expanded={isPopoverOpen}
            aria-haspopup="dialog"
            onClick={handleTogglePopover}
            ref={triggerRef}
          />
        </div>

        <CollectionsPortal
          open={isPopoverOpen}
          pos={popoverPos}
          popoverRef={popoverRef}
          collections={allCollections}
          memberCollectionIds={memberCollectionIds}
          pendingCollectionIds={pendingCollectionIds}
          onToggle={handleCollectionToggle}
          onClose={closeAll}
        />

        {/* Footer (prototype direction): recency left, Quiz action right */}
        <MaterialCardFooter material={material} onStartQuiz={onStartQuiz} />
      </div>
    </Card>
  );
}

MaterialCard.displayName = 'MaterialCard';
