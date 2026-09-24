import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  Server,
  Laptop,
  GitMerge,
  Check,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Button } from '../../../shared/ui/Button/Button';
import { TextArea } from '../../../shared/ui/TextArea/TextArea';
import { useConflictDrafts } from '../hooks/useConflictDrafts';
import type { ConflictDraft } from '../../../domain/sync/models/sync.types';

export interface ConflictDraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: string;
}

type Resolution = 'keep_server' | 'keep_local' | 'merge';

const styles = stylex.create({
  subtitle: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  draftPagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    backgroundColor: 'var(--color-background-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
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
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
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
    backgroundColor: 'var(--color-background-surface)',
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
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
    color: 'var(--color-accent)',
  },
  localBadge: {
    backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-warning) 30%, transparent)',
    color: 'var(--color-warning)',
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
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
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

function DiffContent({
  activeDraft,
  isMerging,
  mergedText,
  onMergedTextChange,
}: {
  activeDraft: ConflictDraft;
  isMerging: boolean;
  mergedText: string;
  onMergedTextChange: (value: string) => void;
}) {
  return (
    <>
      <div {...stylex.props(styles.diffGrid)}>
        {/* Server Version Card */}
        <div {...stylex.props(styles.versionCard)}>
          <div {...stylex.props(styles.versionHeader)}>
            <div {...stylex.props(styles.versionTitleGroup)}>
              <Server size={16} color="var(--color-accent)" />
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
              <Laptop size={16} color="var(--color-warning)" />
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
          <span {...stylex.props(styles.mergeLabel)}>
            <GitMerge size={16} /> Edit & Merge Content:
          </span>
          {/* `autoGrow` is off deliberately: the adapter's auto-grow forces
              `resize: none` plus a computed height, while Astryx's own textarea
              style already offers native vertical resize — which is exactly
              what a large merge blob wants. The old bespoke rule's other two
              points (monospace, a ~180px floor) are preserved here. */}
          <TextArea
            label="Edit and merge content"
            labelHidden
            value={mergedText}
            onChange={onMergedTextChange}
            placeholder="Combine or edit your document content here..."
            rows={9}
            autoGrow={false}
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          />
        </div>
      )}
    </>
  );
}

function DraftPagination({
  currentIndex,
  total,
  isResolving,
  onPrevious,
  onNext,
}: {
  currentIndex: number;
  total: number;
  isResolving: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (total <= 1) return null;
  return (
    <div {...stylex.props(styles.draftPagination)}>
      <span>
        Conflict {currentIndex + 1} of {total}
      </span>
      <div {...stylex.props(styles.paginationControls)}>
        <button
          type="button"
          {...stylex.props(styles.navButton)}
          disabled={currentIndex === 0 || isResolving}
          onClick={onPrevious}
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <button
          type="button"
          {...stylex.props(styles.navButton)}
          disabled={currentIndex === total - 1 || isResolving}
          onClick={onNext}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function ResolutionFooter({
  activeDraft,
  isMerging,
  isResolving,
  onResolve,
  onClose,
  onStartMerge,
  onCancelMerge,
}: {
  activeDraft?: ConflictDraft;
  isMerging: boolean;
  isResolving: boolean;
  onResolve: (resolution: Resolution) => void;
  onClose: () => void;
  onStartMerge: () => void;
  onCancelMerge: () => void;
}) {
  const closeButton = (
    <Button
      label="Close"
      variant="primary"
      onClick={onClose}
    >
      Close
    </Button>
  );

  if (!activeDraft) {
    return closeButton;
  }

  if (isMerging) {
    return (
      <>
        <Button
          label="Cancel Merge"
          variant="secondary"
          isDisabled={isResolving}
          onClick={onCancelMerge}
        >
          Cancel Merge
        </Button>
        <Button
          label="Save Merged Version"
          variant="primary"
          isDisabled={isResolving}
          onClick={() => onResolve('merge')}
        >
          Save Merged Version
        </Button>
      </>
    );
  }

  return (
    <>
      <Button
        label="Keep Server Version"
        variant="secondary"
        isDisabled={isResolving}
        onClick={() => onResolve('keep_server')}
      >
        Keep Server Version
      </Button>
      <Button
        label="Keep My Version"
        variant="secondary"
        isDisabled={isResolving}
        onClick={() => onResolve('keep_local')}
      >
        Keep My Version
      </Button>
      <Button
        label="Edit & Merge"
        variant="primary"
        isDisabled={isResolving}
        onClick={onStartMerge}
        icon={<GitMerge size={14} />}
      >
        Edit & Merge
      </Button>
    </>
  );
}

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

  const handleResolve = async (resolution: Resolution) => {
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
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Resolve Sync Conflicts"
      width={600}
      footer={
        <div {...stylex.props(styles.footer)}>
          <ResolutionFooter
            activeDraft={activeDraft}
            isMerging={isMerging}
            isResolving={isResolving}
            onResolve={handleResolve}
            onClose={onClose}
            onStartMerge={() => setIsMerging(true)}
            onCancelMerge={() => setIsMerging(false)}
          />
        </div>
      }
    >
      <div {...stylex.props(styles.body)}>
        <p {...stylex.props(styles.subtitle)}>
          Changes made on another device conflict with your local offline edits.
        </p>

        <DraftPagination
          currentIndex={currentIndex}
          total={drafts.length}
          isResolving={isResolving}
          onPrevious={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          onNext={() => setCurrentIndex((prev) => Math.min(drafts.length - 1, prev + 1))}
        />

        {isLoading ? (
          <div {...stylex.props(styles.emptyState)}>
            <RotateCcw size={24} className="lucide-spin" />
            <span>Loading conflicting drafts...</span>
          </div>
        ) : !activeDraft ? (
          <div {...stylex.props(styles.emptyState)}>
            <Check size={28} color="var(--color-success)" />
            <span>All conflicts have been resolved.</span>
          </div>
        ) : (
          <DiffContent
            activeDraft={activeDraft}
            isMerging={isMerging}
            mergedText={mergedText}
            onMergedTextChange={setMergedText}
          />
        )}
      </div>
    </Dialog>
  );
}
