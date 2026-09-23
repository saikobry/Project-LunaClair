import { useMemo, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  BookOpen,
  HelpCircle,
  Award,
  Layers,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Calendar,
  User,
} from 'lucide-react';
import type { StudyPackage } from '../../../domain/package/models/package.types';
import { inspectStudyPackage } from '../../../domain/package/engines/inspectStudyPackage';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Chip } from '../../../shared/ui/Chip/Chip';
import { Button } from '../../../shared/ui/Button/Button';

export interface StudyPackagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageData: StudyPackage | null;
  onConfirmImport: () => Promise<void>;
  isImporting?: boolean;
}

const styles = stylex.create({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  description: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  /** Shared `Chip` pills — the app's one tag vocabulary, wrapping in the modal. */
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: -8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    '@media (max-width: 600px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 14px',
    backgroundColor: 'var(--color-background-muted)',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    gap: 4,
  },
  statCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
  },
  typeBadgesContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  typeBadgesList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '3px 8px',
    borderRadius: 6,
    backgroundColor: 'var(--color-background-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
  },
  destinationSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    backgroundColor: 'var(--color-background-muted)',
    borderRadius: 12,
    border: '1px solid var(--color-border)',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    '@media (max-width: 500px)': {
      gridTemplateColumns: '1fr',
    },
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  select: {
    padding: '9px 12px',
    fontSize: 13,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-background-surface)',
    outlineStyle: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
    ':focus': {
      borderColor: 'var(--color-accent)',
      boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
    },
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
});


function formatQuestionType(type: string): string {
  switch (type) {
    case 'multiple_choice':
      return 'Multiple Choice';
    case 'multiple_select':
      return 'Multiple Select';
    case 'true_false':
      return 'True/False';
    case 'identification':
      return 'Identification';
    case 'fill_in_blank':
      return 'Fill in Blank';
    default:
      return type.replace(/_/g, ' ');
  }
}

function formatPackageDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function StudyPackagePreviewModal({
  isOpen,
  onClose,
  packageData,
  onConfirmImport,
  isImporting = false,
}: StudyPackagePreviewModalProps) {
  // Derive all inspection statistics purely from inspectStudyPackage
  const summary = useMemo(() => {
    if (!packageData) return null;
    return inspectStudyPackage(packageData);
  }, [packageData]);

  const handleClose = useCallback(() => {
    if (isImporting) return;
    onClose();
  }, [isImporting, onClose]);

  if (!isOpen || !packageData || !summary) {
    return null;
  }

  const handleConfirm = async () => {
    await onConfirmImport();
  };

  const questionTypeEntries = Object.entries(summary.questionsByType);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={summary.title || 'Study Package Preview'}
      width={640}
      footer={
        <div {...stylex.props(styles.footer)}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={onClose}
            isDisabled={isImporting}
          />
          <Button
            label={isImporting ? 'Importing...' : 'Import to Library'}
            variant="primary"
            onClick={handleConfirm}
            isDisabled={isImporting}
            icon={isImporting ? <Loader2 size={16} className="lucide-spin" /> : undefined}
          >
            {isImporting ? 'Importing...' : 'Import to Library'}
          </Button>
        </div>

      }
    >
      <div {...stylex.props(styles.body)}>
        {summary.description && (
          <p {...stylex.props(styles.description)}>{summary.description}</p>
        )}

        <div {...stylex.props(styles.metaRow)}>
          {summary.author && (
            <span {...stylex.props(styles.metaItem)}>
              <User size={13} />
              {summary.author}
            </span>
          )}
          {summary.createdAt && (
            <span {...stylex.props(styles.metaItem)}>
              <Calendar size={13} />
              {formatPackageDate(summary.createdAt)}
            </span>
          )}
        </div>

        {/* Material tags travel with the package — show them before importing,
            not only after the material lands in the library. */}
        {summary.tags.length > 0 && (
          <div {...stylex.props(styles.tagRow)}>
            {summary.tags.map((tag) => (
              <Chip key={tag} variant="neutral">
                #{tag}
              </Chip>
            ))}
          </div>
        )}

        {/* Summary Stat Cards */}
        <div>
          <h3 {...stylex.props(styles.sectionTitle)}>Package Contents</h3>
          <div {...stylex.props(styles.statsGrid)} style={{ marginTop: 10 }}>
            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <BookOpen size={15} />
                <span>Materials</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.materialCount}</span>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <HelpCircle size={15} />
                <span>Questions</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.questionCount}</span>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <Award size={15} />
                <span>Quizzes</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.quizCount}</span>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <Layers size={15} />
                <span>Flashcards</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.flashcardCount}</span>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <ImageIcon size={15} />
                <span>Assets</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.assetCount}</span>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <Sparkles size={15} />
                <span>Total Points</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.totalPoints}</span>
            </div>
          </div>
        </div>

        {/* Question Type Breakdown */}
        {questionTypeEntries.length > 0 && (
          <div {...stylex.props(styles.typeBadgesContainer)}>
            <span {...stylex.props(styles.sectionTitle)}>Question Types</span>
            <div {...stylex.props(styles.typeBadgesList)}>
              {questionTypeEntries.map(([type, count]) => (
                <span key={type} {...stylex.props(styles.typeBadge)}>
                  {formatQuestionType(type)}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
