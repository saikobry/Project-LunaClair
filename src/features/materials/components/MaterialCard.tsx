import { type KeyboardEvent, type MouseEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit, ClipboardList, FolderPlus, SquarePen, Trash2 } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { Card } from '../../../shared/ui/Card/Card';
import { Button } from '../../../shared/ui/Button/Button';
import { Chip } from '../../../shared/ui/Chip/Chip';
import { cardStyles } from './materialCard.stylex';
import { ActionMenu } from '../../../shared/components/ActionMenu/ActionMenu';
import { ActionMenuItem } from '../../../shared/components/ActionMenu/ActionMenuItem';

export interface MaterialCardProps {
  material: StudyMaterial;
  /** Optional term chip label (e.g. "Week 3") */
  termTitle?: string;
  onOpen: (material: StudyMaterial) => void;
  onEdit?: (material: StudyMaterial) => void;
  onDelete?: (material: StudyMaterial) => void;
  onStartQuiz?: (material: StudyMaterial) => void;
  onManage?: (material: StudyMaterial) => void;
  onManageCollections?: (material: StudyMaterial) => void;
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

export function MaterialCard({
  material,
  termTitle,
  onOpen,
  onEdit,
  onDelete,
  onStartQuiz,
  onManage,
  onManageCollections,
}: MaterialCardProps) {
  const handleCardClick = () => {
    onOpen(material);
  };

  const handleCardKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(material);
    }
  };

  const handleEdit = () => {
    onEdit?.(material);
  };

  const handleDelete = () => {
    onDelete?.(material);
  };

  const handleStartQuiz = (e: MouseEvent) => {
    e.stopPropagation();
    onStartQuiz?.(material);
  };

  const handleManage = (e: MouseEvent) => {
    e.stopPropagation();
    onManage?.(material);
  };

  const handleManageCollections = () => {
    onManageCollections?.(material);
  };

  const hasMenuActions = Boolean(onEdit || onDelete || onManageCollections);

  return (
    <Card aria-hidden={true}>
      <div
        {...stylex.props(cardStyles.interactive, cardStyles.clickableArea)}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        aria-label={`Open ${material.title}`}
      >
        {/* Header: Title + Badges + Action Menu */}
        <div {...stylex.props(cardStyles.header)}>
          <div {...stylex.props(cardStyles.titleColumn)}>
            <h3 {...stylex.props(cardStyles.title)}>{material.title}</h3>
            <div {...stylex.props(cardStyles.badgeRow)}>
              {termTitle && <Chip variant="accent">{termTitle}</Chip>}
            </div>
          </div>
          {hasMenuActions && (
            <ActionMenu>
              {onEdit && (
                <ActionMenuItem
                  icon={<SquarePen size={14} />}
                  label="Edit"
                  description="Modify this material"
                  onClick={handleEdit}
                />
              )}
              {onDelete && (
                <ActionMenuItem
                  icon={<Trash2 size={14} />}
                  label="Delete"
                  description="This action cannot be undone"
                  onClick={handleDelete}
                />
              )}
              {onManageCollections && (
                <ActionMenuItem
                  icon={<FolderPlus size={14} />}
                  label="Add to Collection..."
                  description="Organize into collections"
                  onClick={handleManageCollections}
                />
              )}
            </ActionMenu>
          )}
        </div>

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
