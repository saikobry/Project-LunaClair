import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Document } from '../../domain/reader';
import type { AnnotationMode, DrawingTool, HighlightColor } from '../../shared/types';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button';
import { useHighlights } from './hooks/useHighlights';
import { useDrawings } from './hooks/useDrawings';
import { useTextSelection } from './hooks/useTextSelection';
import ReaderView from './ReaderView';

interface ReaderScreenProps {
  document: Document | null;
  onBackToLibrary: () => void;
}

export default function ReaderScreen({ document, onBackToLibrary }: ReaderScreenProps) {
  const documentId = document?.id ?? 'unknown';

  const {
    highlights,
    containerRef,
    addHighlight,
    deleteHighlight,
    clearHighlights,
  } = useHighlights(documentId);

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

  const handleClearDrawings = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all drawings?')) {
      clearDrawings();
    }
  }, [clearDrawings]);

  const handleClearHighlights = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all highlights?')) {
      clearHighlights();
    }
  }, [clearHighlights]);

  const content = document?.content ?? '';

  return (
    <Page
      title={document?.title ?? 'Reader'}
      actions={
        <Button
          label="Back to Library"
          variant="secondary"
          icon={<ArrowLeft size={16} />}
          onClick={onBackToLibrary}
        >
          Back to Library
        </Button>
      }
    >
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
    </Page>
  );
}
