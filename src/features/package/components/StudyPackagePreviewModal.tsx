import { useState, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  X,
  Package,
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
import { useSubjects } from '../../catalog/subjects/hooks/queries/useSubjects';
import { useTerms } from '../../catalog/terms/hooks/queries/useTerms';

export interface ImportOptions {
  subjectId?: string;
  termId?: string;
}

export interface StudyPackagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageData: StudyPackage | null;
  onConfirmImport: (options: ImportOptions) => Promise<void>;
  isImporting?: boolean;
}

const styles = stylex.create({
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 16,
    boxSizing: 'border-box',
  },
  dialog: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90vh',
    backgroundColor: 'var(--color-background-surface, #ffffff)',
    borderRadius: 16,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--color-border)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    gap: 16,
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: 'var(--color-primary, #6366f1)',
    flexShrink: 0,
    marginTop: 2,
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
    wordBreak: 'break-word',
  },
  headerDescription: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  headerMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  headerMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      color: 'var(--color-text-primary)',
    },
  },
  body: {
    padding: 24,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    flex: 1,
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
    backgroundColor: 'var(--color-background-muted, #f9fafb)',
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
    backgroundColor: 'var(--color-background-muted, #f9fafb)',
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
      borderColor: 'var(--color-primary, #6366f1)',
      boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
    },
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '16px 24px',
    borderTop: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.15s ease',
    outline: 'none',
    ':disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
  },
  btnSecondary: {
    backgroundColor: 'var(--color-background-muted)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-primary)',
    ':hover:not(:disabled)': {
      backgroundColor: 'var(--color-border)',
    },
  },
  btnPrimary: {
    backgroundColor: 'var(--color-primary, #6366f1)',
    color: '#ffffff',
    ':hover:not(:disabled)': {
      opacity: 0.9,
    },
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
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  const { subjects } = useSubjects();
  const { terms } = useTerms(selectedSubjectId || undefined);

  // Derive all inspection statistics purely from inspectStudyPackage
  const summary = useMemo(() => {
    if (!packageData) return null;
    return inspectStudyPackage(packageData);
  }, [packageData]);

  if (!isOpen || !packageData || !summary) {
    return null;
  }

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubjectId(e.target.value);
    setSelectedTermId('');
  };

  const handleConfirm = async () => {
    const options: ImportOptions = {
      subjectId: selectedSubjectId || undefined,
      termId: selectedTermId || undefined,
    };
    await onConfirmImport(options);
  };

  const questionTypeEntries = Object.entries(summary.questionsByType);

  return (
    <div
      {...stylex.props(styles.backdrop)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="package-preview-modal-title"
    >
      <div {...stylex.props(styles.dialog)}>
        {/* Header */}
        <div {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.headerTitleGroup)}>
            <div {...stylex.props(styles.headerIconWrapper)}>
              <Package size={22} />
            </div>
            <div {...stylex.props(styles.headerContent)}>
              <h2 id="package-preview-modal-title" {...stylex.props(styles.headerTitle)}>
                {summary.title || 'Study Package Preview'}
              </h2>
              {summary.description && (
                <p {...stylex.props(styles.headerDescription)}>{summary.description}</p>
              )}
              <div {...stylex.props(styles.headerMetaRow)}>
                {summary.author && (
                  <span {...stylex.props(styles.headerMetaItem)}>
                    <User size={13} />
                    {summary.author}
                  </span>
                )}
                {summary.createdAt && (
                  <span {...stylex.props(styles.headerMetaItem)}>
                    <Calendar size={13} />
                    {formatPackageDate(summary.createdAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            {...stylex.props(styles.closeButton)}
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isImporting}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div {...stylex.props(styles.body)}>
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

          {/* Destination Assignment Picker */}
          <div {...stylex.props(styles.destinationSection)}>
            <span {...stylex.props(styles.sectionTitle)}>Destination in Library</span>
            <div {...stylex.props(styles.fieldGrid)}>
              <div {...stylex.props(styles.fieldGroup)}>
                <label htmlFor="package-dest-subject" {...stylex.props(styles.label)}>
                  Subject (Optional)
                </label>
                <select
                  id="package-dest-subject"
                  {...stylex.props(styles.select)}
                  value={selectedSubjectId}
                  onChange={handleSubjectChange}
                  disabled={isImporting}
                >
                  <option value="">Unassigned (General Library)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div {...stylex.props(styles.fieldGroup)}>
                <label htmlFor="package-dest-term" {...stylex.props(styles.label)}>
                  Term (Optional)
                </label>
                <select
                  id="package-dest-term"
                  {...stylex.props(styles.select)}
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  disabled={isImporting || terms.length === 0}
                >
                  <option value="">No Term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div {...stylex.props(styles.footer)}>
          <button
            type="button"
            {...stylex.props(styles.actionButton, styles.btnSecondary)}
            onClick={onClose}
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            type="button"
            {...stylex.props(styles.actionButton, styles.btnPrimary)}
            onClick={handleConfirm}
            disabled={isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 size={16} className="lucide-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <span>Import to Library</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
