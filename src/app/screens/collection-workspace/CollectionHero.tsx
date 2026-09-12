import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, Plus, SquarePen, Target, Trash2, Zap } from 'lucide-react';
import type { Collection } from '../../../domain/collections/models/Collection';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { COLLECTION_ICONS } from '../../../features/collections/modals/collectionAppearance';
import { Button } from '../../../shared/ui/Button/Button';

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

const styles = stylex.create({
  hero: {
    width: '100%',
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  hubBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
    color: 'var(--color-text-secondary, #9b91ae)',
  },
  hubDot: {
    width: 6,
    height: 6,
    borderRadius: 9999,
  },
  iconButton: {
    position: 'relative',
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    padding: 0,
    // Visible (not hidden) so the focus badge can straddle the
    // bottom-right border; the hover overlay clips itself via its own
    // border radius below.
    overflow: 'visible',
    transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease',
    ':hover': {
      transform: 'scale(1.06)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
    },
    ':active': {
      transform: 'scale(0.98)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent, #a78bfa)',
      outlineOffset: 3,
    },
  },
  iconBlurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 13,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    backdropFilter: 'blur(3px)',
    color: '#ffffff',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.18s ease',
  },
  iconBlurOverlayVisible: {
    opacity: 1,
  },
  iconEditBadge: {
    position: 'absolute',
    // Straddles the bottom-right border (half in, half out) so the
    // badge sits on the frame edge without covering the logo glyph.
    right: -7,
    bottom: -7,
    width: 20,
    height: 20,
    borderRadius: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-secondary, #6e647f)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.18)',
    opacity: 0,
    transform: 'scale(0.6)',
    pointerEvents: 'none',
    transition: 'opacity 0.18s ease, transform 0.18s ease',
  },
  iconEditBadgeVisible: {
    opacity: 1,
    transform: 'scale(1)',
  },
  content: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 680,
  },
  titleEditIcon: {
    color: 'var(--color-text-secondary, #6e647f)',
    flexShrink: 0,
    opacity: 0.6,
  },
  titleInput: {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 32,
    lineHeight: 1.25,
    minHeight: 48,
    fontWeight: 600,
    letterSpacing: '-0.5px',
    color: 'var(--color-text-primary)',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 8,
    padding: '6px 10px',
    marginLeft: -10,
    outline: 'none',
    transition: 'border-color 0.16s ease',
    ':hover': {
      borderColor: 'var(--color-border, rgba(120, 115, 140, 0.25))',
    },
    ':focus': {
      borderColor: '#a78bfa',
      backgroundColor: 'transparent',
    },
  },
  descriptionInput: {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 13.5,
    lineHeight: 1.5,
    minHeight: 44,
    color: 'var(--color-text-secondary)',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 8,
    padding: '10px 12px',
    marginLeft: -8,
    outline: 'none',
    transition: 'border-color 0.16s ease',
    ':hover': {
      borderColor: 'var(--color-border, rgba(120, 115, 140, 0.25))',
    },
    ':focus': {
      borderColor: '#a78bfa',
      backgroundColor: 'transparent',
    },
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
    fontSize: 12,
    color: 'var(--color-text-secondary, #b1aabb)',
    marginTop: 14,
    marginBottom: 4,
  },
  statItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    color: 'var(--color-text-secondary, #9b91ae)',
    flexShrink: 0,
  },
  statValue: {
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 12,
  },
  helper: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginTop: 8,
  },
});

/** Builds a subtle tinted gradient from a hex color at low opacity. */
function heroBackground(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return `radial-gradient(120% 160% at 0% 0%, ${color}26 0%, transparent 60%), radial-gradient(100% 140% at 100% 100%, ${color}14 0%, transparent 55%)`;
  }
  return `radial-gradient(120% 160% at 0% 0%, color-mix(in srgb, ${color} 15%, transparent) 0%, transparent 60%)`;
}

/** Tints a hex color with an alpha suffix; falls back to color-mix. */
function tint(color: string, alphaHex: string, percent: number): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return `${color}${alphaHex}`;
  }
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
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
  const color = collection.color ?? '#60a5fa';

  const [titleDraft, setTitleDraft] = useState(collection.title);
  const [descriptionDraft, setDescriptionDraft] = useState(collection.description ?? '');
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [isIconFocused, setIsIconFocused] = useState(false);

  // Re-seed drafts when the targeted collection or its server values change
  // (guarded render-phase adjustment — the documented React pattern, same as
  // EditCollectionModal). In-progress edits are preserved across refetches
  // that return identical server values.
  const [prevKey, setPrevKey] = useState(
    `${collection.id}:${collection.title}:${collection.description ?? ''}`,
  );
  const nextKey = `${collection.id}:${collection.title}:${collection.description ?? ''}`;
  if (nextKey !== prevKey) {
    setPrevKey(nextKey);
    setTitleDraft(collection.title);
    setDescriptionDraft(collection.description ?? '');
  }

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed.length === 0) {
      setTitleDraft(collection.title);
      return;
    }
    if (trimmed !== collection.title) {
      onUpdateTitle(trimmed);
    }
  };

  const commitDescription = () => {
    const original = collection.description ?? '';
    if (descriptionDraft !== original) {
      onUpdateDescription(descriptionDraft);
    }
  };

  const materialCount = materials.length;

  return (
    <section
      {...stylex.props(styles.hero)}
      style={{
        background: heroBackground(color),
        borderColor: tint(color, '30', 19),
      }}
      aria-label={`Collection: ${collection.title}`}
    >
      <div {...stylex.props(styles.topRow)}>
        <button
          type="button"
          onClick={() => {
            // Clear hover/focus before opening the edit dialog: focus
            // returns to this button when the dialog closes while the
            // pointer is still over the dialog, so no mouseLeave would
            // fire to hide the overlay.
            setIsIconHovered(false);
            setIsIconFocused(false);
            onEdit();
          }}
          onMouseEnter={() => setIsIconHovered(true)}
          onMouseLeave={() => setIsIconHovered(false)}
          onFocus={(event) => {
            // Keyboard-only badge: mouse focus (including dialog focus
            // restore after a pointer Save) must not light the badge, or
            // it sticks with no mouseLeave to clear it.
            if ((event.target as HTMLButtonElement).matches(':focus-visible')) {
              setIsIconFocused(true);
            }
          }}
          onBlur={() => setIsIconFocused(false)}
          aria-label="Edit Collection"
          title="Customize icon and color"
          {...stylex.props(styles.iconButton)}
          style={{
            color,
            backgroundColor: tint(color, '1A', 10),
            borderColor: tint(color, '40', 25),
          }}
        >
          <Icon size={26} />
          <span
            {...stylex.props(
              styles.iconBlurOverlay,
              isIconHovered && styles.iconBlurOverlayVisible,
            )}
            aria-hidden="true"
          >
            <SquarePen size={18} />
          </span>
          <span
            {...stylex.props(
              styles.iconEditBadge,
              isIconFocused && !isIconHovered && styles.iconEditBadgeVisible,
            )}
            aria-hidden="true"
          >
            <SquarePen size={11} />
          </span>
        </button>
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
            icon={<Trash2 size={15} style={{ color: 'var(--color-danger, #ef4444)' }} />}
            onClick={onDelete}
            tooltip="Delete Collection"
            style={{ color: 'var(--color-danger, #ef4444)' }}
          />
        </div>
      </div>
      <div {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.titleRow)}>
          <input
            type="text"
            value={titleDraft}
            maxLength={60}
            aria-label="Collection title, edit inline"
            title="Click to rename collection"
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                (event.target as HTMLInputElement).blur();
              } else if (event.key === 'Escape') {
                setTitleDraft(collection.title);
                (event.target as HTMLInputElement).blur();
              }
            }}
            {...stylex.props(styles.titleInput)}
          />
          <SquarePen size={13} {...stylex.props(styles.titleEditIcon)} aria-hidden="true" />
        </div>
        <input
          type="text"
          value={descriptionDraft}
          maxLength={160}
          placeholder="Add a little purpose to this collection..."
          aria-label="Collection description, edit inline"
          onChange={(event) => setDescriptionDraft(event.target.value)}
          onBlur={commitDescription}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              (event.target as HTMLInputElement).blur();
            } else if (event.key === 'Escape') {
              setDescriptionDraft(collection.description ?? '');
              (event.target as HTMLInputElement).blur();
            }
          }}
          {...stylex.props(styles.descriptionInput)}
        />
        <div {...stylex.props(styles.stats)}>
          <span {...stylex.props(styles.statItem)}>
            <BookOpen size={14} {...stylex.props(styles.statIcon)} aria-hidden="true" />
            <b {...stylex.props(styles.statValue)}>{materialCount}</b> {materialCount === 1 ? 'Material' : 'Materials'}
          </span>
          {' · '}
          <span {...stylex.props(styles.statItem)}>
            <Zap size={14} {...stylex.props(styles.statIcon)} aria-hidden="true" />
            <b {...stylex.props(styles.statValue)}>{quizCount}</b> {quizCount === 1 ? 'Quiz' : 'Quizzes'}
          </span>
          {' · '}
          <span {...stylex.props(styles.statItem)}>
            <Target size={14} {...stylex.props(styles.statIcon)} aria-hidden="true" />
            <b {...stylex.props(styles.statValue)}>{averageMastery}%</b> Average mastery
          </span>
        </div>
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
