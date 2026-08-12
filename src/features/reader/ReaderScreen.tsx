import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { FileQuestion } from 'lucide-react';
import { DocumentNotFoundError } from '../../domain/reader/DocumentNotFoundError';
import type { AnnotationMode, DrawingTool, HighlightColor } from '../../domain/reader/annotation.types';
import { ConfirmationDialog } from '../../shared/ui/Dialog/ConfirmationDialog';
import { useMaterial } from '../catalog/materials/hooks/queries/useMaterial';
import { useToast } from '../../app/providers/ToastContext';
import { useDocument } from './hooks/useDocument';
import { useHighlights } from './hooks/useHighlights';
import { useDrawings } from './hooks/useDrawings';
import { useTextSelection } from './hooks/useTextSelection';
import ReaderView from './ReaderView';

const styles = stylex.create({
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '64px 24px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
  errorIcon: {
    color: 'var(--color-text-disabled)',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  errorSubtext: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: 'var(--color-text-secondary)',
    fontSize: 14,
  },
});

interface ReaderScreenProps {
  materialId: string;
}

export default function ReaderScreen({ materialId }: ReaderScreenProps) {
  const { material, isLoading: materialLoading } = useMaterial(materialId);
  const { showToast } = useToast();
  const { data: document, isLoading: docLoading, error } = useDocument(material ?? null);
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

  const { paths, handlePathsChange, handleUndo, clearDrawings } = useDrawings(documentId, mode === 'draw');

  const { popover, setPopover } = useTextSelection(mode, highlights, containerRef);

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
      <div {...stylex.props(styles.errorContainer)}>
        <div {...stylex.props(styles.errorIcon)}>
          <FileQuestion size={48} />
        </div>
        <h2 {...stylex.props(styles.errorTitle)}>Material could not be found.</h2>
      </div>
    );
  }

  if (error instanceof DocumentNotFoundError) {
    return (
      <div {...stylex.props(styles.errorContainer)}>
        <div {...stylex.props(styles.errorIcon)}>
          <FileQuestion size={48} />
        </div>
        <h2 {...stylex.props(styles.errorTitle)}>Document could not be found.</h2>
        <p {...stylex.props(styles.errorSubtext)}>
          This material may have been moved or deleted.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div {...stylex.props(styles.errorContainer)}>
        <h2 {...stylex.props(styles.errorTitle)}>Something went wrong.</h2>
        <p {...stylex.props(styles.errorSubtext)}>
          An unexpected error occurred while loading this document.
        </p>
      </div>
    );
  }

  return (
    <>
      <ReaderView
        content={content}
        containerRef={containerRef}
        mode={mode}
        onModeChange={setMode}
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
