import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, Plus, SquarePen, Target, Trash2, Zap } from 'lucide-react';
import { DEFAULT_COLLECTION_COLOR, type Collection } from '../../../../domain/collections/models/Collection';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import {
  COLLECTION_ICONS,
  collectionHeroBackground,
  collectionTint,
} from '../../../../features/collections/modals/collectionAppearance';
import { Button } from '../../../../shared/ui/Button/Button';
import { styles } from '../styles/collectionHero.stylex';
import { useInlineEditDraft } from '../hooks/useInlineEditDraft';

export interface CollectionHeroProps {
  collection: Collection;
  materials: StudyMaterial[];
  quizCount: number;
  averageMastery: number;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string) => void;
  onQuickStudy: () => void;
  onAddMaterials: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * The collection's icon tile. Clicking it opens the edit dialog; hover shows a
 * blur overlay and keyboard focus (only `:focus-visible`) shows a corner badge,
 * so the affordance is discoverable without a permanent edit label.
 */
function CollectionIconButton({
  Icon,
  color,
  onEdit,
}: {
  Icon: (typeof COLLECTION_ICONS)[string];
  color: string;
  onEdit: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        // Clear hover/focus before opening the edit dialog: focus returns to
        // this button when the dialog closes while the pointer is still over
        // the dialog, so no mouseLeave would fire to hide the overlay.
        setIsHovered(false);
        setIsFocused(false);
        onEdit();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={(event) => {
        // Keyboard-only badge: mouse focus (including dialog focus restore
        // after a pointer Save) must not light the badge, or it sticks with no
        // mouseLeave to clear it.
        if ((event.target as HTMLButtonElement).matches(':focus-visible')) {
          setIsFocused(true);
        }
      }}
      onBlur={() => setIsFocused(false)}
      aria-label="Edit Collection"
      title="Customize icon and color"
      {...stylex.props(styles.iconButton)}
      style={{
        color,
        backgroundColor: collectionTint(color, '1A', 10),
        borderColor: collectionTint(color, '40', 25),
      }}
    >
      <Icon size={26} />
      <span
        {...stylex.props(styles.iconBlurOverlay, isHovered && styles.iconBlurOverlayVisible)}
        aria-hidden="true"
      >
        <SquarePen size={18} />
      </span>
      <span
        {...stylex.props(styles.iconEditBadge, isFocused && !isHovered && styles.iconEditBadgeVisible)}
        aria-hidden="true"
      >
        <SquarePen size={11} />
      </span>
    </button>
  );
}

/** Materials / quizzes / average-mastery summary row. */
function CollectionStats({
  materialCount,
  quizCount,
  averageMastery,
}: {
  materialCount: number;
  quizCount: number;
  averageMastery: number;
}) {
  return (
    <div {...stylex.props(styles.stats)}>
      <span {...stylex.props(styles.statItem)}>
        <BookOpen size={14} {...stylex.props(styles.statIcon)} aria-hidden="true" />
        <b {...stylex.props(styles.statValue)}>{materialCount}</b>{' '}
        {materialCount === 1 ? 'Material' : 'Materials'}
      </span>
      {' · '}
      <span {...stylex.props(styles.statItem)}>
        <Zap size={14} {...stylex.props(styles.statIcon)} aria-hidden="true" />
        <b {...stylex.props(styles.statValue)}>{quizCount}</b>{' '}
        {quizCount === 1 ? 'Quiz' : 'Quizzes'}
      </span>
      {' · '}
      <span {...stylex.props(styles.statItem)}>
        <Target size={14} {...stylex.props(styles.statIcon)} aria-hidden="true" />
        <b {...stylex.props(styles.statValue)}>{averageMastery}%</b> Average mastery
      </span>
    </div>
  );
}

export function CollectionHero({
  collection,
  materials,
  quizCount,
  averageMastery,
  onUpdateTitle,
  onUpdateDescription,
  onQuickStudy,
  onAddMaterials,
  onEdit,
  onDelete,
}: CollectionHeroProps) {
  // Record lookup (same default as getCollectionIcon) kept as member access
  // so no component is created during render.
  const Icon = (collection.icon && COLLECTION_ICONS[collection.icon]) || COLLECTION_ICONS.folder;
  const color = collection.color ?? DEFAULT_COLLECTION_COLOR;

  const title = useInlineEditDraft({
    value: collection.title,
    resetKey: `${collection.id}:${collection.title}`,
    onCommit: (next) => {
      const trimmed = next.trim();
      // Reject an all-whitespace title — the draft reverts to the server value.
      if (trimmed.length === 0) return false;
      if (trimmed !== collection.title) onUpdateTitle(trimmed);
      return undefined;
    },
  });

  const description = useInlineEditDraft({
    value: collection.description ?? '',
    resetKey: `${collection.id}:${collection.description ?? ''}`,
    onCommit: (next) => {
      if (next !== (collection.description ?? '')) onUpdateDescription(next);
      return undefined;
    },
  });

  const materialCount = materials.length;

  return (
    <section
      {...stylex.props(styles.hero)}
      style={{
        background: collectionHeroBackground(color),
        borderColor: collectionTint(color, '30', 19),
      }}
      aria-label={`Collection: ${collection.title}`}
    >
      <div {...stylex.props(styles.topRow)}>
        <CollectionIconButton Icon={Icon} color={color} onEdit={onEdit} />
        <div {...stylex.props(styles.topRight)}>
          <span {...stylex.props(styles.hubBadge)}>
            <span
              {...stylex.props(styles.hubDot)}
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            Your study hub
          </span>
          <Button
            label="Delete Collection"
            variant="ghost"
            isIconOnly
            icon={<Trash2 size={15} style={{ color: 'var(--color-error)' }} />}
            onClick={onDelete}
            tooltip="Delete Collection"
            style={{ color: 'var(--color-error)' }}
          />
        </div>
      </div>
      <div {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.titleRow)}>
          <input
            type="text"
            maxLength={60}
            aria-label="Collection title, edit inline"
            title="Click to rename collection"
            {...title.inputProps}
            {...stylex.props(styles.titleInput)}
          />
          <SquarePen size={13} {...stylex.props(styles.titleEditIcon)} aria-hidden="true" />
        </div>
        <input
          type="text"
          maxLength={160}
          placeholder="Add a little purpose to this collection..."
          aria-label="Collection description, edit inline"
          {...description.inputProps}
          {...stylex.props(styles.descriptionInput)}
        />
        <CollectionStats
          materialCount={materialCount}
          quizCount={quizCount}
          averageMastery={averageMastery}
        />
        <div {...stylex.props(styles.actions)}>
          <Button
            label="Quick Study"
            variant="primary"
            icon={<Zap size={16} />}
            isDisabled={quizCount === 0}
            onClick={onQuickStudy}
          >
            Quick Study →
          </Button>
          <Button
            label="Add Materials"
            variant="secondary"
            icon={<Plus size={16} />}
            onClick={onAddMaterials}
          >
            Add Materials
          </Button>
        </div>
        <div {...stylex.props(styles.helper)}>
          {quizCount > 0 ? (
            <>Quick Study combines all {quizCount} quizzes into one focused session.</>
          ) : (
            <>Add quizzes to materials in this collection to enable Quick Study.</>
          )}
        </div>
      </div>
    </section>
  );
}

export default CollectionHero;
