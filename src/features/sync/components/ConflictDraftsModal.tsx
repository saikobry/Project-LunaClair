import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  AlertTriangle,
  Server,
  Laptop,
  GitMerge,
  Check,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useConflictDrafts } from '../hooks/useConflictDrafts';
import type { ConflictDraft } from '../../../domain/sync/sync.types';

export interface ConflictDraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: string;
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
    maxWidth: 840,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    margin: 0,
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
  draftPagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    backgroundColor: 'var(--color-background-muted)',
    borderBottom: '1px solid var(--color-border)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  navButton: {
    background: 'none',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-background-surface)',
    ':disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
  },
  body: {
    padding: 20,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flex: 1,
  },
  diffGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    '@media (max-width: 700px)': {
      gridTemplateColumns: '1fr',
    },
  },
  versionCard: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'var(--color-background)',
  },
  versionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
  },
  versionTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  serverBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    color: '#2563eb',
  },
  localBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    color: '#d97706',
  },
  contentPre: {
    margin: 0,
    padding: 14,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    lineHeight: '1.5',
    color: 'var(--color-text-primary)',
    maxHeight: 280,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  mergeSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
  },
  mergeLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  mergeTextarea: {
    width: '100%',
    minHeight: 180,
    padding: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 13,
    lineHeight: '1.5',
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-background-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    boxSizing: 'border-box',
    resize: 'vertical',
    outline: 'none',
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
    padding: '14px 20px',
    borderTop: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    flexWrap: 'wrap',
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.15s ease',
    outline: 'none',
    ':disabled': {
      opacity: 0.5,
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
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: 12,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
  },
});

export function ConflictDraftsModal({
  isOpen,
  onClose,
  documentId,
}: ConflictDraftsModalProps) {
  const { drafts, isLoading, resolveDraft } = useConflictDrafts(documentId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedText, setMergedText] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const safeIndex = drafts.length > 0 ? Math.min(currentIndex, drafts.length - 1) : 0;
  const activeDraft: ConflictDraft | undefined = drafts[safeIndex];

  const activeDraftId = activeDraft?.id;
  const initialMergedContent = activeDraft?.localContent || activeDraft?.serverContent || '';

  const [prevDraftId, setPrevDraftId] = useState(activeDraftId);
  if (activeDraftId !== prevDraftId) {
    setPrevDraftId(activeDraftId);
    setMergedText(initialMergedContent);
    setIsMerging(false);
  }

  if (!isOpen) return null;

  const handleResolve = async (
    resolution: 'keep_server' | 'keep_local' | 'merge'
  ) => {
    if (!activeDraft) return;

    setIsResolving(true);
    try {
      if (resolution === 'merge') {
        await resolveDraft({
          draftId: activeDraft.id,
          resolution: 'merge',
          mergedContent: mergedText,
        });
      } else {
        await resolveDraft({
          draftId: activeDraft.id,
          resolution,
        });
      }

      // If this was the last remaining draft, close modal
      if (drafts.length <= 1) {
        onClose();
      }
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div
      {...stylex.props(styles.backdrop)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div {...stylex.props(styles.dialog)}>
        {/* Header */}
        <div {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.headerTitleGroup)}>
            <div {...stylex.props(styles.headerIconWrapper)}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 id="conflict-modal-title" {...stylex.props(styles.headerTitle)}>
                Resolve Document Conflicts
              </h2>
              <p {...stylex.props(styles.headerSubtitle)}>
                Changes made on another device conflict with your local offline edits.
              </p>
            </div>
          </div>
          <button
            type="button"
            {...stylex.props(styles.closeButton)}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Multi-draft pagination bar */}
        {drafts.length > 1 && (
          <div {...stylex.props(styles.draftPagination)}>
            <span>
              Conflict {currentIndex + 1} of {drafts.length}
            </span>
            <div {...stylex.props(styles.paginationControls)}>
              <button
                type="button"
                {...stylex.props(styles.navButton)}
                disabled={currentIndex === 0 || isResolving}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                type="button"
                {...stylex.props(styles.navButton)}
                disabled={currentIndex === drafts.length - 1 || isResolving}
                onClick={() => setCurrentIndex((prev) => Math.min(drafts.length - 1, prev + 1))}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div {...stylex.props(styles.body)}>
          {isLoading ? (
            <div {...stylex.props(styles.emptyState)}>
              <RotateCcw size={24} className="lucide-spin" />
              <span>Loading conflicting drafts...</span>
            </div>
          ) : !activeDraft ? (
            <div {...stylex.props(styles.emptyState)}>
              <Check size={28} color="#10b981" />
              <span>All conflicts have been resolved.</span>
            </div>
          ) : (
            <>
              <div {...stylex.props(styles.diffGrid)}>
                {/* Server Version Card */}
                <div {...stylex.props(styles.versionCard)}>
                  <div {...stylex.props(styles.versionHeader)}>
                    <div {...stylex.props(styles.versionTitleGroup)}>
                      <Server size={16} color="#2563eb" />
                      <span>Server Version (Canonical)</span>
                    </div>
                    <span {...stylex.props(styles.badge, styles.serverBadge)}>
                      v{activeDraft.serverVersion}
                    </span>
                  </div>
                  <pre {...stylex.props(styles.contentPre)}>
                    {activeDraft.serverContent || '*(Empty content)*'}
                  </pre>
                </div>

                {/* Local Version Card */}
                <div {...stylex.props(styles.versionCard)}>
                  <div {...stylex.props(styles.versionHeader)}>
                    <div {...stylex.props(styles.versionTitleGroup)}>
                      <Laptop size={16} color="#d97706" />
                      <span>Your Local Version (Divergent)</span>
                    </div>
                    <span {...stylex.props(styles.badge, styles.localBadge)}>
                      base v{activeDraft.baseVersion}
                    </span>
                  </div>
                  <pre {...stylex.props(styles.contentPre)}>
                    {activeDraft.localContent || '*(Empty content)*'}
                  </pre>
                </div>
              </div>

              {/* Editable Merge Textarea */}
              {isMerging && (
                <div {...stylex.props(styles.mergeSection)}>
                  <label htmlFor="merge-content-input" {...stylex.props(styles.mergeLabel)}>
                    <GitMerge size={16} /> Edit & Merge Content:
                  </label>
                  <textarea
                    id="merge-content-input"
                    {...stylex.props(styles.mergeTextarea)}
                    value={mergedText}
                    onChange={(e) => setMergedText(e.target.value)}
                    placeholder="Combine or edit your document content here..."
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div {...stylex.props(styles.footer)}>
          {!activeDraft ? (
            <button
              type="button"
              {...stylex.props(styles.actionButton, styles.btnPrimary)}
              onClick={onClose}
            >
              Close
            </button>
          ) : isMerging ? (
            <>
              <button
                type="button"
                {...stylex.props(styles.actionButton, styles.btnSecondary)}
                disabled={isResolving}
                onClick={() => setIsMerging(false)}
              >
                Cancel Merge
              </button>
              <button
                type="button"
                {...stylex.props(styles.actionButton, styles.btnPrimary)}
                disabled={isResolving}
                onClick={() => handleResolve('merge')}
              >
                Save Merged Version
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                {...stylex.props(styles.actionButton, styles.btnSecondary)}
                disabled={isResolving}
                onClick={() => handleResolve('keep_server')}
              >
                Keep Server Version
              </button>
              <button
                type="button"
                {...stylex.props(styles.actionButton, styles.btnSecondary)}
                disabled={isResolving}
                onClick={() => handleResolve('keep_local')}
              >
                Keep My Version
              </button>
              <button
                type="button"
                {...stylex.props(styles.actionButton, styles.btnPrimary)}
                disabled={isResolving}
                onClick={() => setIsMerging(true)}
              >
                <GitMerge size={14} /> Edit & Merge
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
