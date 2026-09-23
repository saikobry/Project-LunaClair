import { useCallback, useEffect, useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate } from '../../../domain/importer/models/importer.types';
import type { AiModelDescriptor } from '../../../domain/ai/services/aiModelCatalog';
import { DEFAULT_FAST_PATH_THRESHOLD } from '../../../domain/importer/services/DocumentChunker';
import {
  WriterEditor,
  type WriterEditorHandle,
  type WriterSelection,
} from '../../writer/components/WriterEditor';
import MarkdownViewer from '../../reader/components/MarkdownViewer';
import { useAiCleanup, type AiCleanupProgress } from '../hooks/useAiCleanup';
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

/** How long the selection-cleanup confirmation stays on screen. */
const SELECTION_NOTICE_MS = 2_500;

/** Section position for the action label, e.g. `Cleaning section 2 of 4 (50%)...`. */
function progressLabel(progress: AiCleanupProgress): string {
  if (progress.phase === 'cooldown') return progress.label;
  return `Cleaning section ${progress.current} of ${progress.total} (${progress.percent}%)...`;
}

// The accessible name is the dynamic label: the countdown, the section being
// cleaned, and the in-flight state are the information a screen-reader user
// needs, not just the action.
function aiCleanupLabel(state: {
  isCleaning: boolean;
  cooldownSeconds: number;
  hasSelection: boolean;
  progress: AiCleanupProgress | null;
}): string {
  if (state.isCleaning) {
    if (state.progress) return progressLabel(state.progress);
    return state.hasSelection ? 'Cleaning selection...' : 'Cleaning with AI...';
  }
  if (state.cooldownSeconds > 0) return `AI Cleanup (${state.cooldownSeconds}s)`;
  return state.hasSelection ? 'Clean Selection' : 'AI Cleanup';
}

/**
 * Whether the next cleanup would be one oversized request.
 *
 * Only the single-request path can ask a model for more than it accepts: a longer document is sent
 * section by section, and each section's size is derived from the model's own output reservation.
 * The guard is therefore narrow on purpose — "the document is longer than the model's document cap"
 * would block exactly the documents chunking exists to clean.
 */
function isOverBudgetFor(chars: number, model: AiModelDescriptor | null): boolean {
  if (!model || chars <= 0 || chars > DEFAULT_FAST_PATH_THRESHOLD) return false;
  return chars > model.maxDocumentContextChars;
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
  hasSelection,
  progress,
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
  /** A text selection is available to clean in place instead of the whole document. */
  hasSelection: boolean;
  progress: AiCleanupProgress | null;
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
    : hasSelection
      ? 'Clean only the selected text'
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
          label={aiCleanupLabel({ isCleaning, cooldownSeconds, hasSelection, progress })}
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

interface ReviewBannersProps {
  error: string | null;
  canRetryRemaining: boolean;
  onRetryRemaining: () => void;
  onAbortCleanup: () => void;
  selectionNotice: { tone: 'success' | 'error'; text: string } | null;
  isPartial: boolean | undefined;
  pagesCount?: number;
  totalPages?: number;
}

function ReviewBanners({
  error,
  canRetryRemaining,
  onRetryRemaining,
  onAbortCleanup,
  selectionNotice,
  isPartial,
  pagesCount,
  totalPages,
}: ReviewBannersProps) {
  return (
    <>
      {error && (
        <div
          role="alert"
          {...stylex.props(importerStyles.bannerRow, importerStyles.bannerError)}
        >
          <span {...stylex.props(importerStyles.bannerText)}>{error}</span>
          <div {...stylex.props(importerStyles.bannerActions)}>
            {canRetryRemaining && (
              <Button
                variant="secondary"
                label="Retry Remaining"
                onClick={onRetryRemaining}
              />
            )}
            <Button variant="ghost" label="Cancel" onClick={onAbortCleanup} />
          </div>
        </div>
      )}
      {selectionNotice && (
        <div
          role="status"
          {...stylex.props(
            importerStyles.bannerRow,
            selectionNotice.tone === 'success'
              ? importerStyles.bannerSuccess
              : importerStyles.bannerError,
          )}
        >
          {selectionNotice.tone === 'success' && <CheckCircle2 size={16} aria-hidden="true" />}
          <span {...stylex.props(importerStyles.bannerText)}>{selectionNotice.text}</span>
        </div>
      )}
      {isPartial && pagesCount !== undefined && totalPages !== undefined && (
        <PartialExtractionBanner
          pagesCount={pagesCount}
          totalPages={totalPages}
        />
      )}
    </>
  );
}

function useCandidateReviewSync(
  activeCandidate: ImportCandidate | undefined,
  abortCleanup: () => void,
) {
  const [markdown, setMarkdown] = useState(activeCandidate?.markdown || '');
  const [editorKey, setEditorKey] = useState(0);
  const [prevCandidateId, setPrevCandidateId] = useState(activeCandidate?.id);
  const [selection, setSelection] = useState<WriterSelection | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  if (activeCandidate && activeCandidate.id !== prevCandidateId) {
    setPrevCandidateId(activeCandidate.id);
    setMarkdown(activeCandidate.markdown || '');
    setSelection(null);
    setSelectionNotice(null);
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

  useEffect(() => {
    if (!selectionNotice) return;
    const timer = setTimeout(() => setSelectionNotice(null), SELECTION_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [selectionNotice]);

  return {
    markdown,
    setMarkdown,
    editorKey,
    setEditorKey,
    selection,
    setSelection,
    selectionNotice,
    setSelectionNotice,
  };
}

export function ImportReviewView({
  candidates,
  activeIndex,
  onUpdateMarkdown,
  onSelectCandidate,
}: ImportReviewViewProps) {
  const activeCandidate = candidates[activeIndex];
  const [viewMode, setViewMode] = useState<ReviewViewMode>('split');
  const editorRef = useRef<WriterEditorHandle>(null);
  const {
    isCleaning,
    diffResult,
    error,
    progress,
    canRetryRemaining,
    cleanWithAi,
    cleanSelection,
    retryRemaining,
    acceptCleanup,
    rejectCleanup,
    abortCleanup,
    cooldownSeconds,
  } = useAiCleanup();
  const modelSelection = useAiModelSelection();

  const {
    markdown,
    setMarkdown,
    editorKey,
    setEditorKey,
    selection,
    setSelection,
    selectionNotice,
    setSelectionNotice,
  } = useCandidateReviewSync(activeCandidate, abortCleanup);

  const handleSelectionChange = useCallback((next: WriterSelection | null) => {
    setSelection(next);
  }, [setSelection]);

  if (!activeCandidate) return null;

  const hasSelection = selection !== null;
  const requestChars = selection ? selection.markdown.length : markdown.length;
  const isOverBudget = isOverBudgetFor(requestChars, modelSelection.selectedModel ?? null);
  const cleanupOptions = {
    model: modelSelection.selectedModelId ?? undefined,
    catalog: modelSelection.catalog,
  };

  const handleTriggerAiCleanup = async () => {
    const activeSelection = selection;
    if (activeSelection) {
      const cleaned = await cleanSelection(
        activeSelection.markdown.trim() || activeSelection.text,
        activeCandidate.title,
        cleanupOptions,
      );
      if (!cleaned) return;

      if (editorRef.current?.replaceSelection(cleaned)) {
        setSelectionNotice({
          tone: 'success',
          text: 'Selection cleaned. Press Ctrl+Z (Cmd+Z) to undo.',
        });
      } else {
        setSelectionNotice({
          tone: 'error',
          text: 'The selection was lost before the cleaned text could be applied. Select the text again and retry.',
        });
      }
      return;
    }

    await cleanWithAi(markdown, activeCandidate.id, activeCandidate.title, cleanupOptions);
  };

  const handleRetryRemaining = async () => {
    await retryRemaining(activeCandidate.id);
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
        hasSelection={hasSelection}
        progress={progress}
        onTriggerAiCleanup={handleTriggerAiCleanup}
      />

      <ReviewBanners
        error={error}
        canRetryRemaining={canRetryRemaining}
        onRetryRemaining={handleRetryRemaining}
        onAbortCleanup={abortCleanup}
        selectionNotice={selectionNotice}
        isPartial={activeCandidate.extraction?.isPartial}
        pagesCount={activeCandidate.extraction?.pages.length}
        totalPages={activeCandidate.extraction?.pageCount}
      />

      <div {...stylex.props(importerStyles.reviewBody)}>
        {showEditor && (
          <div {...stylex.props(importerStyles.reviewCenter)}>
            <PaneHeader title="Edit Content" />
            <WriterEditor
              key={`${activeCandidate.id}-${editorKey}`}
              initialMarkdown={markdown}
              editorRef={editorRef}
              onSelectionChange={handleSelectionChange}
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
