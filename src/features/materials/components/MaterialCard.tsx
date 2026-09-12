import { type KeyboardEvent, type MouseEvent, type RefObject, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit, ClipboardList, FolderPlus, Plus, X, Check, Folder, SquarePen, Trash2 } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Collection } from '../../../domain/collections/models/Collection';
import { Card } from '../../../shared/ui/Card/Card';
import { Button } from '../../../shared/ui/Button/Button';
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
}

function formatDate(iso: string | undefined): string {
  if (!iso) return 'Never';
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
  onToggle: (collection: Collection) => void;
  onClose: () => void;
}

/** Inline collection-assignment popover. One real <button> per collection row. */
function MaterialCollectionsPopover({
  popoverRef,
  collections,
  memberCollectionIds,
  onToggle,
  onClose,
}: MaterialCollectionsPopoverProps) {
  return (
    <div ref={popoverRef} {...stylex.props(cardStyles.popover)}>
      <div {...stylex.props(cardStyles.popoverHeader)}>
        <div {...stylex.props(cardStyles.popoverHeaderRow)}>
          <span {...stylex.props(cardStyles.popoverTitle)}>Add to collections</span>
          <IconButton
            label="Close popover"
            icon={<X size={14} />}
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>
        <p {...stylex.props(cardStyles.popoverSubtitle)}>
          One material. As many playlists as you like.
        </p>
      </div>
      <div {...stylex.props(cardStyles.popoverList)}>
        {collections.length === 0 ? (
          <p {...stylex.props(cardStyles.popoverEmpty)}>
            No collections yet. Create one first.
          </p>
        ) : (
          collections.map((collection) => {
            const isInCollection = memberCollectionIds.has(collection.id);
            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => onToggle(collection)}
                {...stylex.props(cardStyles.popoverRow)}
              >
                <div
                  {...stylex.props(cardStyles.popoverIcon)}
                  style={{
                    backgroundColor: `${collection.color ?? '#a78bfa'}12`,
                    borderColor: `${collection.color ?? '#a78bfa'}25`,
                    color: collection.color ?? '#a78bfa',
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
}

/** Collection membership badges, or the "not filed yet" hint. */
function MaterialCollectionBadges({
  collections,
  onNavigate,
}: MaterialCollectionBadgesProps) {
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

  return (
    <div {...stylex.props(cardStyles.membershipSection)}>
      <div {...stylex.props(cardStyles.badgeRow)}>
        {collections.map((collection) => (
          <button
            key={collection.id}
            type="button"
            onClick={() => onNavigate?.(collection.id)}
            {...stylex.props(
              cardStyles.badgeButton,
              onNavigate ? cardStyles.badgeButtonClickable : cardStyles.badgeButtonStatic,
            )}
            style={{
              backgroundColor: `${collection.color ?? '#a78bfa'}12`,
              borderColor: `${collection.color ?? '#a78bfa'}25`,
              color: collection.color ?? '#a78bfa',
            }}
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

export function MaterialCard({
  material,
  onOpen,
  onEdit,
  onDelete,
  onStartQuiz,
  onManage,
  onNavigate,
}: MaterialCardProps) {
  const { collections: memberCollections } = useMaterialCollections(material.id);
  const { collections: allCollections } = useCollections();
  const addMutation = useAddMaterialToCollection();
  const removeMutation = useRemoveMaterialFromCollection();
  const { showToast } = useToast();

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Membership is re-checked per popover row and per badge, so resolve it once
  // per render instead of scanning the list each time.
  const memberCollectionIds = useMemo(
    () => new Set(memberCollections.map((c) => c.id)),
    [memberCollections],
  );

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const mouseEvent = event as unknown as MouseEvent;
      if (popoverRef.current && !popoverRef.current.contains(mouseEvent.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: Event) => {
      const keyboardEvent = event as unknown as KeyboardEvent;
      if (keyboardEvent.key === 'Escape' && isPopoverOpen) {
        setIsPopoverOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isPopoverOpen]);

  const handleCollectionToggle = useCallback((collection: Collection) => {
    const isInCollection = memberCollectionIds.has(collection.id);
    if (isInCollection) {
      removeMutation.mutate({ collectionId: collection.id, materialId: material.id });
      showToast(`Removed from ${collection.title}`, { intent: 'info' });
    } else {
      addMutation.mutate({ collectionId: collection.id, materialId: material.id });
      showToast(`Added to ${collection.title}`, { intent: 'success' });
    }
    setIsPopoverOpen(false);
  }, [memberCollectionIds, addMutation, removeMutation, material.id, showToast]);

  const handleStartQuiz = (e: MouseEvent) => {
    e.stopPropagation();
    onStartQuiz?.(material);
  };

  const handleManage = (e: MouseEvent) => {
    e.stopPropagation();
    onManage?.(material);
  };

  return (
    <Card>
      {/*
       * Presentational shell: the card is no longer a `role="button"` wrapper,
       * so the title button, collection toggles, and badges below each keep
       * their own semantics, focus order, and keyboard behavior.
       */}
      <div {...stylex.props(cardStyles.interactive, cardStyles.clickableArea)}>
        {/* Header: Title + Collection Assignment Button + Actions */}
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
            <IconButton
              label={isPopoverOpen ? `Close collections for ${material.title}` : `Add ${material.title} to collections`}
              icon={<FolderPlus size={16} />}
              variant="ghost"
              size="sm"
              aria-expanded={isPopoverOpen}
              aria-haspopup="dialog"
              onClick={() => setIsPopoverOpen((prev) => !prev)}
            />
            {(onEdit || onDelete) && (
              <ActionMenu>
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

        {isPopoverOpen && (
          <MaterialCollectionsPopover
            popoverRef={popoverRef}
            collections={allCollections}
            memberCollectionIds={memberCollectionIds}
            onToggle={handleCollectionToggle}
            onClose={() => setIsPopoverOpen(false)}
          />
        )}

        {/* Description */}
        {material.description && (
          <p {...stylex.props(cardStyles.description)}>{material.description}</p>
        )}

        {/* Tags */}
        {material.tags && material.tags.length > 0 && (
          <div {...stylex.props(cardStyles.tagsRow)}>
            {material.tags.map((tag) => (
              <Chip key={tag} variant="neutral" style={cardStyles.tagChip}>
                #{tag}
              </Chip>
            ))}
          </div>
        )}

        {/* Collection Membership Badges */}
        <MaterialCollectionBadges
          collections={memberCollections}
          onNavigate={onNavigate}
        />

        {/* Last opened */}
        <div {...stylex.props(cardStyles.metaRow)}>
          <BookOpen size={12} />
          <span>Last opened: {formatDate(material.lastOpenedAt)}</span>
        </div>

        {/* Action Bar */}
        {(onStartQuiz || onManage) && (
          <div {...stylex.props(cardStyles.actionBar)}>
            {onStartQuiz && (
              <Button
                label={`Start quiz for ${material.title}`}
                variant="secondary"
                icon={<BrainCircuit size={14} />}
                onClick={handleStartQuiz}
              >
                Start Quiz
              </Button>
            )}
            {onManage && (
              <Button
                label={`Manage questions for ${material.title}`}
                variant="secondary"
                icon={<ClipboardList size={14} />}
                onClick={handleManage}
              >
                Manage
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

MaterialCard.displayName = 'MaterialCard';
