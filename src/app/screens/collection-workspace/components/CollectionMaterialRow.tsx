import * as stylex from '@stylexjs/stylex';
import { BookOpen, ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import { styles } from '../styles/collectionMaterialList.stylex';

export interface CollectionMaterialRowProps {
  material: StudyMaterial;
  /** Zero-based position within the collection. */
  index: number;
  /** Total rows, used to disable the boundary arrows. */
  totalCount: number;
  onOpenMaterial?: (materialId: string) => void;
  onRemoveMaterial: (materialId: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}

/**
 * One playlist row: drag handle, step number, title, tags, mastery bar, and the
 * up/down/remove controls. `data-material-id` and `data-drag-handle` are the
 * DOM contract the reorder hook queries.
 */
export function CollectionMaterialRow({
  material,
  index,
  totalCount,
  onOpenMaterial,
  onRemoveMaterial,
  onMove,
}: CollectionMaterialRowProps) {
  return (
    <article data-material-id={material.id} {...stylex.props(styles.row)}>
      <span
        {...stylex.props(styles.dragHandle)}
        data-drag-handle="true"
        aria-label={`Drag to reorder ${material.title}`}
      >
        <GripVertical size={16} />
      </span>
      <span {...stylex.props(styles.stepNumber)}>{String(index + 1).padStart(2, '0')}</span>
      <div {...stylex.props(styles.iconMark)}>
        <BookOpen size={18} />
      </div>
      <div {...stylex.props(styles.content)}>
        <button
          type="button"
          {...stylex.props(styles.titleButton)}
          onClick={() => onOpenMaterial?.(material.id)}
          title={`Open ${material.title}`}
        >
          <span {...stylex.props(styles.title)}>{material.title}</span>
        </button>
        {material.tags && material.tags.length > 0 && (
          <div {...stylex.props(styles.tags)}>
            {material.tags.slice(0, 3).map((tag) => (
              <span key={tag} {...stylex.props(styles.tagChip)}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div {...stylex.props(styles.masterySection)}>
        <span {...stylex.props(styles.masteryLabel)}>0%</span>
        <div {...stylex.props(styles.progressBar)}>
          <div {...stylex.props(styles.progressFill)} style={{ width: '0%' }} />
        </div>
      </div>
      <div {...stylex.props(styles.actions)}>
        <div {...stylex.props(styles.arrowGroup)}>
          <IconButton
            label={`Move ${material.title} up`}
            icon={<ChevronUp size={13} />}
            variant="ghost"
            size="sm"
            xstyle={styles.arrowBtn}
            isDisabled={index === 0}
            onClick={() => onMove(index, -1)}
          />
          <IconButton
            label={`Move ${material.title} down`}
            icon={<ChevronDown size={13} />}
            variant="ghost"
            size="sm"
            xstyle={styles.arrowBtn}
            isDisabled={index === totalCount - 1}
            onClick={() => onMove(index, 1)}
          />
        </div>
        <IconButton
          label={`Remove ${material.title} from collection`}
          icon={<X size={14} />}
          variant="ghost"
          size="sm"
          xstyle={styles.removeBtn}
          tooltip="Remove from collection · keep in Library"
          onClick={() => onRemoveMaterial(material.id)}
        />
      </div>
    </article>
  );
}
