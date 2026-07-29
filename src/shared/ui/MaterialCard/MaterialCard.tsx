import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { MoreHorizontal, BookOpen, BrainCircuit, ClipboardList, Pencil, Trash2 } from 'lucide-react';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import type { StudyMaterial } from '../../../domain/library';
import { Card } from '../Card';
import { Button } from '../Button';
import { Chip } from '../Chip/Chip';
import { cardStyles } from './materialCard.stylex';

export interface MaterialCardProps {
  material: StudyMaterial;
  /** Optional term chip label (e.g. "Week 3") */
  termTitle?: string;
  onOpen: (material: StudyMaterial) => void;
  onRename?: (material: StudyMaterial) => void;
  onDelete?: (material: StudyMaterial) => void;
  onStartQuiz?: (material: StudyMaterial) => void;
  onManage?: (material: StudyMaterial) => void;
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
  onRename,
  onDelete,
  onStartQuiz,
  onManage,
}: MaterialCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, closeMenu]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen, closeMenu]);

  const handleCardClick = () => {
    onOpen(material);
  };

  const handleCardKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(material);
    }
  };

  const handleRename = (e: MouseEvent) => {
    e.stopPropagation();
    onRename?.(material);
    closeMenu();
  };

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete?.(material);
    closeMenu();
  };

  const handleStartQuiz = (e: MouseEvent) => {
    e.stopPropagation();
    onStartQuiz?.(material);
  };

  const handleManage = (e: MouseEvent) => {
    e.stopPropagation();
    onManage?.(material);
  };

  const handleMenuBlur = (e: React.FocusEvent) => {
    // Close menu when focus leaves the menu container entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      closeMenu();
    }
  };

  const hasMenuActions = Boolean(onRename || onDelete);

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
        {/* Header: Title + Badges + Ellipsis Menu */}
        <div {...stylex.props(cardStyles.header)}>
          <div {...stylex.props(cardStyles.titleColumn)}>
            <h3 {...stylex.props(cardStyles.title)}>{material.title}</h3>
            <div {...stylex.props(cardStyles.badgeRow)}>
              {termTitle && <Chip variant="accent">{termTitle}</Chip>}
              <Chip variant="neutral">{material.sourceType}</Chip>
            </div>
          </div>
          {hasMenuActions && (
            <div ref={menuRef} style={{ position: 'relative' }} onBlur={handleMenuBlur}>
              <ToggleButton
                label="Card actions"
                icon={<MoreHorizontal size={16} />}
                isIconOnly
                isPressed={menuOpen}
                onPressedChange={(_pressed, e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
              />

              {menuOpen && (
                <div {...stylex.props(cardStyles.menuPopup)} role="menu">
                  {onRename && (
                    <Button
                      label="Rename"
                      variant="secondary"
                      icon={<Pencil size={14} />}
                      width="100%"
                      onClick={handleRename}
                    >
                      Rename
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      label="Delete"
                      variant="secondary"
                      icon={<Trash2 size={14} />}
                      width="100%"
                      onClick={handleDelete}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {material.description && (
          <p {...stylex.props(cardStyles.description)}>{material.description}</p>
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
