import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { FileQuestion, FileText, PenTool } from 'lucide-react';
import { DocumentNotFoundError } from '../../domain/reader/errors/DocumentNotFoundError';
import type { AnnotationMode, DrawingTool, HighlightColor } from '../../domain/reader/models/annotation.types';
import { ConfirmationDialog } from '../../shared/ui/Dialog/ConfirmationDialog';
import { ErrorState } from '../../shared/ui/ErrorState/ErrorState';
import { Button } from '../../shared/ui/Button/Button';
import { useMaterial } from '../materials/hooks/queries/useMaterial';
import { useToast } from '../../app/providers/ToastContext';
import { useDocument } from './hooks/useDocument';
import { useMaterialAssets } from './hooks/useMaterialAssets';
import { useHighlights } from './hooks/useHighlights';
import { useDrawings } from './hooks/useDrawings';
import { useTextSelection } from './hooks/useTextSelection';
import ReaderView from './components/ReaderView';

const styles = stylex.create({
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: 'var(--color-text-secondary)',
    fontSize: 14,
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '420px',
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '440px',
    padding: '40px 32px',
  },
  emptyIconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    marginBottom: '20px',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    marginBottom: '8px',
    letterSpacing: '-0.01em',
  },
  emptyDescription: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: 'var(--color-text-secondary)',
    margin: 0,
    marginBottom: '24px',
  },
});

export interface ReaderSelectionEvent {
  text: string;
  action: 'explain' | 'simplify' | 'example';
}

interface ReaderTabProps {
  materialId: string;
  onNavigateToWrite?: () => void;
  onAskAiSelection?: (selection: ReaderSelectionEvent) => void;
  /**
   * Whether the Read tab is showing. The workspace sets it false off-Read:
   * the portaled toolbar hides, draw-mode body scroll-lock releases, and the
   * selection listener stops opening popovers — while persisted annotation
   * state stays mounted. Defaults true (standalone reader behavior).
   */
  isActive?: boolean;
}

export default function ReaderTab({
  materialId,
  onNavigateToWrite,
  onAskAiSelection,
  isActive = true,
}: ReaderTabProps) {
  const { material, isLoading: materialLoading } = useMaterial(materialId);
  const { showToast } = useToast();
  const { data: document, isLoading: docLoading, error } = useDocument(material ?? null);
  const assetUrls = useMaterialAssets(materialId);
  const content = document?.content ?? '';
  const documentId = materialId;

  const {
    highlights,
    containerRef,
    addHighlight,
    deleteHighlight,
    clearHighlights,
  } = useHighlights(documentId, content);

  const [mode, setMode] = useState<AnnotationMode>('select');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('pen');
  const [brushColor, setBrushColor] = useState<string>('#ef4444');
  const [brushThickness, setBrushThickness] = useState<number>(4);

  const { paths, handlePathsChange, handleUndo, clearDrawings } = useDrawings(documentId, mode === 'draw' && isActive);

  const { popover, setPopover } = useTextSelection(mode, highlights, containerRef, isActive);

  // Clear UI selection when a highlight is created
  const handleCreateHighlight = useCallback(
    (color: HighlightColor) => {
      if (!popover.pendingSelection) return;
      addHighlight(
        popover.pendingSelection.start,
        popover.pendingSelection.end,
        color,
        popover.pendingSelection.text,
      );
      window.getSelection()?.removeAllRanges();
      setPopover({ x: 0, y: 0, visible: false });
    },
    [popover.pendingSelection, addHighlight, setPopover],
  );

  const handleDeleteHighlight = useCallback(() => {
    if (!popover.targetHighlightId) return;
    deleteHighlight(popover.targetHighlightId);
    setPopover({ x: 0, y: 0, visible: false });
  }, [popover.targetHighlightId, deleteHighlight, setPopover]);

  const [confirmTarget, setConfirmTarget] = useState<'drawings' | 'highlights' | null>(null);

  const handleClearDrawings = useCallback(() => {
    setConfirmTarget('drawings');
  }, []);

  const handleClearHighlights = useCallback(() => {
    setConfirmTarget('highlights');
  }, []);

  const handleConfirmClear = useCallback(() => {
    if (confirmTarget === 'drawings') {
      clearDrawings();
      showToast('Canvas drawings cleared', { intent: 'info' });
    } else if (confirmTarget === 'highlights') {
      clearHighlights();
      showToast('Text highlights cleared', { intent: 'info' });
    }
    setConfirmTarget(null);
  }, [confirmTarget, clearDrawings, clearHighlights, showToast]);

  const isLoading = materialLoading || docLoading;

  if (isLoading) {
    return (
      <div {...stylex.props(styles.loading)}>Loading document...</div>
    );
  }

  if (!material) {
    return (
      <ErrorState
        icon={<FileQuestion size={28} />}
        title="Material could not be found."
      />
    );
  }

  if (error instanceof DocumentNotFoundError) {
    return (
      <ErrorState
        icon={<FileQuestion size={28} />}
        title="Document could not be found."
        description="This material may have been moved or deleted."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Something went wrong."
        description="An unexpected error occurred while loading this document."
      />
    );
  }

  const hasContent = content.trim().length > 0;
  if (!hasContent) {
    return (
      <div {...stylex.props(styles.emptyContainer)}>
        <div {...stylex.props(styles.emptyCard)}>
          <div {...stylex.props(styles.emptyIconBox)}>
            <FileText size={28} />
          </div>
          <h2 {...stylex.props(styles.emptyTitle)}>No Content Yet</h2>
          <p {...stylex.props(styles.emptyDescription)}>
            This study material doesn't have any notes or text yet. Add notes, summary, or lecture material to study and annotate.
          </p>
          {onNavigateToWrite && (
            <Button
              label="Start Writing"
              icon={<PenTool size={15} />}
              variant="primary"
              onClick={onNavigateToWrite}
            >
              Start Writing
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <ReaderView
        content={content}
        assetUrls={assetUrls}
        containerRef={containerRef}
        mode={mode}
        onModeChange={setMode}
        toolbarHidden={!isActive}
        drawingTool={drawingTool}
        onToolChange={setDrawingTool}
        brushColor={brushColor}
        onColorChange={setBrushColor}
        brushThickness={brushThickness}
        onThicknessChange={setBrushThickness}
        onUndo={handleUndo}
        onClearDrawings={handleClearDrawings}
        onClearHighlights={handleClearHighlights}
        hasDrawings={paths.length > 0}
        hasHighlights={highlights.length > 0}
        paths={paths}
        onPathsChange={handlePathsChange}
        popover={popover}
        onCreateHighlight={handleCreateHighlight}
        onDeleteHighlight={handleDeleteHighlight}
        onClosePopover={() => setPopover({ x: 0, y: 0, visible: false })}
        onAskAiSelection={
          onAskAiSelection
            ? (action, text) => onAskAiSelection({ text, action })
            : undefined
        }
      />

      <ConfirmationDialog
        isOpen={confirmTarget === 'drawings'}
        title="Clear Drawings"
        message="Are you sure you want to clear all drawings? This cannot be undone."
        confirmLabel="Clear"
        intent="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmTarget(null)}
      />
      <ConfirmationDialog
        isOpen={confirmTarget === 'highlights'}
        title="Clear Highlights"
        message="Are you sure you want to clear all highlights? This cannot be undone."
        confirmLabel="Clear"
        intent="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
