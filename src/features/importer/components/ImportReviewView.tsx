import { useState, useEffect, useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  ChevronDown,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate } from '../../../domain/importer/models/importer.types';
import { WriterEditor } from '../../writer/components/WriterEditor';
import MarkdownViewer from '../../reader/components/MarkdownViewer';
import { useAiCleanup } from '../hooks/useAiCleanup';
import { useAiModelSelection } from '../../ai/hooks/useAiModelSelection';
import { AiModelPicker } from '../../ai/components/AiModelPicker';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Button } from '../../../shared/ui/Button/Button';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';
import { ImportStatusBadge } from './ImportStatusBadge';

type ReviewViewMode = 'split' | 'edit' | 'preview';

interface ImportReviewViewProps {
  candidates: ImportCandidate[];
  activeIndex: number;
  onUpdateMarkdown: (id: string, markdown: string) => void;
  /** Optional so the view stays usable standalone; the wizard always supplies it. */
  onSelectCandidate?: (index: number) => void;
}

interface ImportDiffModalProps {
  diffResult: { original: string; cleaned: string };
  onReject: () => void;
  onAccept: () => void;
}

function ImportDiffModal({ diffResult, onReject, onAccept }: ImportDiffModalProps) {
  return (
    <Dialog
      isOpen
      onClose={onReject}
      title="AI Cleanup Diff Comparison"
      width={900}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="secondary" label="Keep Original" onClick={onReject}>
            Keep Original
          </Button>
          <Button variant="primary" label="Accept AI Cleaned" onClick={onAccept}>
            Accept AI Cleaned
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: '16px', minHeight: '400px' }}>
        <div
          style={{
            flex: 1,
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px',
            overflowY: 'auto',
          }}
        >
          <h4 style={{ marginTop: 0, color: 'var(--color-text-secondary)' }}>Original Extracted Text</h4>
          <MarkdownViewer text={diffResult.original} />
        </div>
        <div
          style={{
            flex: 1,
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px',
            overflowY: 'auto',
          }}
        >
          <h4 style={{ marginTop: 0, color: 'var(--color-accent)' }}>AI Cleaned Structure</h4>
          <MarkdownViewer text={diffResult.cleaned} />
        </div>
      </div>
    </Dialog>
  );
}

// The accessible name is the dynamic label: the countdown and the in-flight
// state are the information a screen-reader user needs, not just the action.
function aiCleanupLabel(isCleaning: boolean, cooldownSeconds: number): string {
  if (isCleaning) return 'Cleaning with AI...';
  if (cooldownSeconds > 0) return `AI Cleanup (${cooldownSeconds}s)`;
  return 'AI Cleanup';
}

/** Page count is an extraction artifact — degrade to nothing when it is absent. */
function PageTag({ candidate }: { candidate: ImportCandidate }) {
  const pageCount = candidate.extraction?.pageCount ?? 0;
  if (pageCount <= 0) return null;

  return (
    <span {...stylex.props(importerStyles.pageTag)}>
      {pageCount} {pageCount === 1 ? 'page' : 'pages'}
    </span>
  );
}

function FileKindIcon({ source }: { source: ImportCandidate['source'] }) {
  return (
    <span {...stylex.props(importerStyles.fileKindIcon)} aria-hidden="true">
      {source === 'pdf' ? <FileText size={14} /> : <ImageIcon size={14} />}
    </span>
  );
}

function PartialExtractionBanner({
  pagesCount,
  totalPages,
}: {
  pagesCount: number;
  totalPages: number;
}) {
  return (
    <div
      data-testid="partial-extraction-banner"
      style={{
        backgroundColor: 'var(--color-warning-muted)',
        color: 'var(--color-warning)',
        padding: '8px 16px',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--color-warning)',
      }}
    >
      <AlertTriangle size={16} />
      <span>
        Extraction was cancelled before completion. Displaying partial content ({pagesCount} of {totalPages} pages).
      </span>
    </div>
  );
}

/**
 * The review-level toolbar. It sits above the panes and is rendered in every
 * view mode on purpose: mounted inside a pane it would unmount the moment the
 * user switched away from Split, stranding them in the mode they picked.
 *
 * It also owns file switching (Option B): the sidebar that used to hold the
 * candidate queue is gone, so the whole width goes to the editor and preview.
 * With one candidate the filename is static; with several it becomes a
 * listbox popover anchored to this toolbar.
 */
function ReviewToolbar({
  activeCandidate,
  candidates,
  activeIndex,
  onSelectCandidate,
  viewMode,
  onViewModeChange,
  modelSelection,
  isOverBudget,
  cooldownSeconds,
  isCleaning,
  onTriggerAiCleanup,
}: {
  activeCandidate: ImportCandidate;
  candidates: ImportCandidate[];
  activeIndex: number;
  onSelectCandidate?: (index: number) => void;
  viewMode: ReviewViewMode;
  onViewModeChange: (mode: ReviewViewMode) => void;
  modelSelection: ReturnType<typeof useAiModelSelection>;
  isOverBudget: boolean;
  cooldownSeconds: number;
  isCleaning: boolean;
  onTriggerAiCleanup: () => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // A single candidate has nothing to switch to: render a static filename so the
  // toolbar costs no extra chrome at all.
  const canSwitchFiles = candidates.length > 1;

  useEffect(() => {
    if (!popoverOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setPopoverOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopoverOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [popoverOpen]);

  const isButtonDisabled =
    isCleaning ||
    cooldownSeconds > 0 ||
    modelSelection.isAiDisabled ||
    modelSelection.isAiUnavailable ||
    isOverBudget;

  const tooltipTitle = isOverBudget
    ? `Document exceeds ${modelSelection.selectedModel?.display.name || 'model'} context limit`
    : undefined;

  return (
    <div {...stylex.props(importerStyles.reviewToolbar)}>
      <div {...stylex.props(importerStyles.reviewToolbarInfo)}>
        {canSwitchFiles ? (
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={popoverOpen}
            onClick={() => setPopoverOpen((open) => !open)}
            {...stylex.props(importerStyles.fileSelectorTrigger)}
          >
            <FileKindIcon source={activeCandidate.source} />
            <span {...stylex.props(importerStyles.reviewToolbarFilename)}>
              {activeCandidate.filename}
            </span>
            <span {...stylex.props(importerStyles.fileIndex)}>
              ({activeIndex + 1} of {candidates.length})
            </span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        ) : (
          <>
            <FileKindIcon source={activeCandidate.source} />
            <span {...stylex.props(importerStyles.reviewToolbarFilename)}>
              {activeCandidate.filename}
            </span>
          </>
        )}
        <ImportStatusBadge status={activeCandidate.status} />
        <PageTag candidate={activeCandidate} />

        {popoverOpen && canSwitchFiles && (
          <div
            ref={popoverRef}
            {...stylex.props(importerStyles.popover)}
            role="listbox"
            aria-label="Select file to review"
          >
            {candidates.map((candidate, index) => {
              const isSelected = candidate.id === activeCandidate.id;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectCandidate?.(index);
                    setPopoverOpen(false);
                    triggerRef.current?.focus();
                  }}
                  {...stylex.props(
                    importerStyles.popoverItem,
                    isSelected && importerStyles.popoverItemSelected,
                  )}
                >
                  <FileKindIcon source={candidate.source} />
                  <span {...stylex.props(importerStyles.popoverFilename)}>
                    {candidate.filename}
                  </span>
                  <ImportStatusBadge status={candidate.status} />
                  <PageTag candidate={candidate} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <SegmentedControl
        value={viewMode}
        onChange={(value) => onViewModeChange(value as ReviewViewMode)}
        label="Review view mode"
        size="sm"
      >
        <SegmentedControlItem value="split" label="Split" />
        <SegmentedControlItem value="edit" label="Editor" />
        <SegmentedControlItem value="preview" label="Preview" />
      </SegmentedControl>

      <div {...stylex.props(importerStyles.reviewToolbarActions)}>
        <AiModelPicker
          models={modelSelection.catalog.models}
          defaultModelId={modelSelection.catalog.defaultModelId}
          isAiDisabled={modelSelection.isAiDisabled}
          selectedModelId={modelSelection.selectedModelId}
          onSelectModel={modelSelection.selectModel}
          isOverBudget={isOverBudget}
          cooldownSeconds={cooldownSeconds}
        />
        <Button
          variant="secondary"
          label={aiCleanupLabel(isCleaning, cooldownSeconds)}
          icon={
            isCleaning ? (
              <Loader2 size={16} {...stylex.props(importerStyles.iconSpin)} aria-hidden="true" />
            ) : (
              <Sparkles size={16} />
            )
          }
          isDisabled={isButtonDisabled}
          tooltip={tooltipTitle}
          onClick={onTriggerAiCleanup}
        />
      </div>
    </div>
  );
}

function PaneHeader({ title }: { title: string }) {
  return (
    <div {...stylex.props(importerStyles.toolbar)}>
      <span>{title}</span>
    </div>
  );
}

function ReviewPreviewPane({ text }: { text: string }) {
  return (
    <div {...stylex.props(importerStyles.reviewRight)}>
      <PaneHeader title="Live Rendered Preview" />
      <MarkdownViewer text={text} />
    </div>
  );
}

export function ImportReviewView({
  candidates,
  activeIndex,
  onUpdateMarkdown,
  onSelectCandidate,
}: ImportReviewViewProps) {
  const activeCandidate = candidates[activeIndex];
  const [markdown, setMarkdown] = useState(activeCandidate?.markdown || '');
  const [viewMode, setViewMode] = useState<ReviewViewMode>('split');
  const {
    isCleaning,
    diffResult,
    error,
    cleanWithAi,
    acceptCleanup,
    rejectCleanup,
    abortCleanup,
    cooldownSeconds,
  } = useAiCleanup();
  const modelSelection = useAiModelSelection();

  const [editorKey, setEditorKey] = useState(0);

  const [prevCandidateId, setPrevCandidateId] = useState(activeCandidate?.id);
  if (activeCandidate && activeCandidate.id !== prevCandidateId) {
    setPrevCandidateId(activeCandidate.id);
    setMarkdown(activeCandidate.markdown || '');
  }

  const activeCandidateId = activeCandidate?.id;
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    abortCleanup();
  }, [activeCandidateId, abortCleanup]);

  if (!activeCandidate) return null;

  const handleTriggerAiCleanup = async () => {
    await cleanWithAi(markdown, activeCandidate.id, activeCandidate.title, {
      model: modelSelection.selectedModelId ?? undefined,
      catalog: modelSelection.catalog,
    });
  };

  const handleAcceptCleanup = () => {
    if (!diffResult || diffResult.candidateId !== activeCandidate.id || diffResult.original !== markdown) {
      rejectCleanup();
      return;
    }
    const cleaned = acceptCleanup();
    if (cleaned) {
      setMarkdown(cleaned);
      onUpdateMarkdown(activeCandidate.id, cleaned);
      setEditorKey((k) => k + 1);
    }
  };

  const isOverBudget = modelSelection.selectedModel
    ? markdown.length > modelSelection.selectedModel.maxDocumentContextChars
    : false;

  const showEditor = viewMode === 'split' || viewMode === 'edit';
  const showPreview = viewMode === 'split' || viewMode === 'preview';

  return (
    <div {...stylex.props(importerStyles.reviewShell)}>
      <ReviewToolbar
        activeCandidate={activeCandidate}
        candidates={candidates}
        activeIndex={activeIndex}
        onSelectCandidate={onSelectCandidate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        modelSelection={modelSelection}
        isOverBudget={isOverBudget}
        cooldownSeconds={cooldownSeconds}
        isCleaning={isCleaning}
        onTriggerAiCleanup={handleTriggerAiCleanup}
      />

      {error && (
        <div
          style={{
            color: 'var(--color-error)',
            padding: '8px 16px',
            fontSize: '13px',
            backgroundColor: 'var(--color-error-muted)',
          }}
        >
          {error}
        </div>
      )}
      {activeCandidate.extraction?.isPartial && (
        <PartialExtractionBanner
          pagesCount={activeCandidate.extraction.pages.length}
          totalPages={activeCandidate.extraction.pageCount}
        />
      )}

      <div {...stylex.props(importerStyles.reviewBody)}>
        {showEditor && (
          <div {...stylex.props(importerStyles.reviewCenter)}>
            <PaneHeader title="Edit Content" />
            <WriterEditor
              key={`${activeCandidate.id}-${editorKey}`}
              initialMarkdown={markdown}
              onChange={(md) => {
                setMarkdown(md);
                onUpdateMarkdown(activeCandidate.id, md);
              }}
            />
          </div>
        )}

        {showPreview && <ReviewPreviewPane text={markdown} />}
      </div>

      {diffResult && (
        <ImportDiffModal
          diffResult={diffResult}
          onReject={rejectCleanup}
          onAccept={handleAcceptCleanup}
        />
      )}
    </div>
  );
}
