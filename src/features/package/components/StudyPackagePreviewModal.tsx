import { useMemo, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Loader2, Calendar, User } from 'lucide-react';
import type { StudyPackage } from '../../../domain/package/models/package.types';
import { inspectStudyPackage } from '../../../domain/package/engines/inspectStudyPackage';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Chip } from '../../../shared/ui/Chip/Chip';
import { Button } from '../../../shared/ui/Button/Button';
import { formatPackageDate } from '../utils/packageFormat';
import { PackageStatsGrid } from './PackageStatsGrid';
import { QuestionTypeBreakdown } from './QuestionTypeBreakdown';

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
          <div style={{ marginTop: 10 }}>
            <PackageStatsGrid summary={summary} />
          </div>
        </div>

        {/* Question Type Breakdown */}
        <QuestionTypeBreakdown entries={questionTypeEntries} chrome="none" />
      </div>
    </Dialog>
  );
}
