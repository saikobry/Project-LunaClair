import { useState, useEffect, useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate } from '../../../domain/importer/models/importer.types';
import { WriterEditor } from '../../writer/components/WriterEditor';
import MarkdownViewer from '../../reader/components/MarkdownViewer';
import { useAiCleanup } from '../hooks/useAiCleanup';
import { useAiModelSelection } from '../../ai/hooks/useAiModelSelection';
import { AiModelPicker } from '../../ai/components/AiModelPicker';

interface ImportReviewViewProps {
  candidates: ImportCandidate[];
  activeIndex: number;
  onUpdateMarkdown: (id: string, markdown: string) => void;
}

interface ImportDiffModalProps {
  diffResult: { original: string; cleaned: string };
  onReject: () => void;
  onAccept: () => void;
}

function ImportDiffModal({ diffResult, onReject, onAccept }: ImportDiffModalProps) {
  return (
    <div {...stylex.props(importerStyles.diffModal)}>
      <div {...stylex.props(importerStyles.diffCard)}>
        <div {...stylex.props(importerStyles.diffHeader)}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--color-accent)" /> AI Cleanup Diff Comparison
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              {...stylex.props(importerStyles.button, importerStyles.buttonSecondary)}
              onClick={onReject}
            >
              Keep Original
            </button>
            <button
              type="button"
              {...stylex.props(importerStyles.button, importerStyles.buttonPrimary)}
              onClick={onAccept}
            >
              Accept AI Cleaned
            </button>
          </div>
        </div>
        <div {...stylex.props(importerStyles.diffContent)}>
          <div {...stylex.props(importerStyles.diffPane)}>
            <h4 style={{ marginTop: 0, color: '#6b7280' }}>Original Extracted Text</h4>
            <MarkdownViewer text={diffResult.original} />
          </div>
          <div {...stylex.props(importerStyles.diffPane)}>
            <h4 style={{ marginTop: 0, color: 'var(--color-accent)' }}>AI Cleaned Structure</h4>
            <MarkdownViewer text={diffResult.cleaned} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AiCleanupButtonContent({ isCleaning, cooldownSeconds }: { isCleaning: boolean; cooldownSeconds: number }) {
  if (isCleaning) {
    return (
      <>
        <Loader2 size={16} className="animate-spin" />
        Cleaning with AI...
      </>
    );
  }
  if (cooldownSeconds > 0) {
    return (
      <>
        <Sparkles size={16} />
        AI Cleanup ({cooldownSeconds}s)
      </>
    );
  }
  return (
    <>
      <Sparkles size={16} />
      AI Cleanup
    </>
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
        backgroundColor: 'var(--color-warning-muted, #fef3c7)',
        color: 'var(--color-warning, #d97706)',
        padding: '8px 16px',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--color-warning-muted, #fde68a)',
      }}
    >
      <AlertTriangle size={16} />
      <span>
        Extraction was cancelled before completion. Displaying partial content ({pagesCount} of {totalPages} pages).
      </span>
    </div>
  );
}

function CandidateFilesList({
  candidates,
  activeCandidateId,
}: {
  candidates: ImportCandidate[];
  activeCandidateId?: string;
}) {
  return (
    <div {...stylex.props(importerStyles.reviewLeft)}>
      <h4>Files</h4>
      {candidates.map((c) => {
        const isActive = c.id === activeCandidateId;
        return (
          <div
            key={c.id}
            style={{
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: isActive ? 'var(--color-accent-muted)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {c.filename}
          </div>
        );
      })}
    </div>
  );
}

function ReviewToolbar({
  modelSelection,
  isOverBudget,
  cooldownSeconds,
  isCleaning,
  onTriggerAiCleanup,
}: {
  modelSelection: ReturnType<typeof useAiModelSelection>;
  isOverBudget: boolean;
  cooldownSeconds: number;
  isCleaning: boolean;
  onTriggerAiCleanup: () => void;
}) {
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
    <div {...stylex.props(importerStyles.toolbar)}>
      <span>Edit Content</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AiModelPicker
          models={modelSelection.catalog.models}
          defaultModelId={modelSelection.catalog.defaultModelId}
          isAiDisabled={modelSelection.isAiDisabled}
          selectedModelId={modelSelection.selectedModelId}
          onSelectModel={modelSelection.selectModel}
          isOverBudget={isOverBudget}
          cooldownSeconds={cooldownSeconds}
        />
        <button
          type="button"
          {...stylex.props(importerStyles.button, importerStyles.buttonSecondary)}
          onClick={onTriggerAiCleanup}
          disabled={isButtonDisabled}
          title={tooltipTitle}
        >
          <AiCleanupButtonContent isCleaning={isCleaning} cooldownSeconds={cooldownSeconds} />
        </button>
      </div>
    </div>
  );
}

function ReviewPreviewPane({ text }: { text: string }) {
  return (
    <div {...stylex.props(importerStyles.reviewRight)}>
      <div {...stylex.props(importerStyles.toolbar)}>
        <span>Live Rendered Preview</span>
      </div>
      <MarkdownViewer text={text} />
    </div>
  );
}

export function ImportReviewView({ candidates, activeIndex, onUpdateMarkdown }: ImportReviewViewProps) {
  const activeCandidate = candidates[activeIndex];
  const [markdown, setMarkdown] = useState(activeCandidate?.markdown || '');
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
    }
  };

  const isOverBudget = modelSelection.selectedModel
    ? markdown.length > modelSelection.selectedModel.maxDocumentContextChars
    : false;

  return (
    <div {...stylex.props(importerStyles.reviewLayout)}>
      <CandidateFilesList candidates={candidates} activeCandidateId={activeCandidate.id} />
      <div {...stylex.props(importerStyles.reviewCenter)}>
        <ReviewToolbar
          modelSelection={modelSelection}
          isOverBudget={isOverBudget}
          cooldownSeconds={cooldownSeconds}
          isCleaning={isCleaning}
          onTriggerAiCleanup={handleTriggerAiCleanup}
        />
        {error && (
          <div style={{ color: '#dc2626', padding: '8px 16px', fontSize: '13px', backgroundColor: '#fee2e2' }}>
            {error}
          </div>
        )}
        {activeCandidate.extraction?.isPartial && (
          <PartialExtractionBanner
            pagesCount={activeCandidate.extraction.pages.length}
            totalPages={activeCandidate.extraction.pageCount}
          />
        )}
        <WriterEditor
          initialMarkdown={markdown}
          onChange={(md) => {
            setMarkdown(md);
            onUpdateMarkdown(activeCandidate.id, md);
          }}
        />
      </div>
      <ReviewPreviewPane text={markdown} />

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
