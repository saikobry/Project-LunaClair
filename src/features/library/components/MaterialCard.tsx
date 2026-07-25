import { type MouseEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, Eye, Pencil, Trash2 } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library';
import { styles } from '../styles/library.stylex';

interface MaterialCardProps {
  material: StudyMaterial;
  onOpen: (material: StudyMaterial) => void;
  onRename: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
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

export default function MaterialCard({ material, onOpen, onRename, onDelete }: MaterialCardProps) {
  const handleOpen = (e: MouseEvent) => {
    e.stopPropagation();
    onOpen(material);
  };
  const handleRename = (e: MouseEvent) => {
    e.stopPropagation();
    onRename(material);
  };
  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete(material);
  };

  return (
    <div {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cardHeader)}>
        <h3 {...stylex.props(styles.cardTitle)}>{material.title}</h3>
        <span {...stylex.props(styles.sourceBadge)}>{material.sourceType}</span>
      </div>

      {material.description && (
        <p {...stylex.props(styles.cardDescription)}>{material.description}</p>
      )}

      <div {...stylex.props(styles.cardMeta)}>
        <BookOpen size={12} />
        <span>Last opened: {formatDate(material.lastOpenedAt)}</span>
      </div>

      <div {...stylex.props(styles.cardActions)}>
        <button
          type="button"
          {...stylex.props(styles.cardActionBtn)}
          onClick={handleOpen}
          title="Open"
          aria-label={`Open ${material.title}`}
        >
          <Eye size={14} />
        </button>
        <button
          type="button"
          {...stylex.props(styles.cardActionBtn)}
          onClick={handleRename}
          title="Rename"
          aria-label={`Rename ${material.title}`}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          {...stylex.props(styles.cardActionBtn, styles.cardActionBtnDanger)}
          onClick={handleDelete}
          title="Delete"
          aria-label={`Delete ${material.title}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
