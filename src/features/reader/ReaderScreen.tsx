import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import type { StudyMaterial } from '../../domain/library';
import { DocumentNotFoundError } from '../../domain/reader/DocumentNotFoundError';
import type { AnnotationMode, DrawingTool, HighlightColor } from '../../shared/types';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button';
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
    color: '#6b6375',
  },
  errorIcon: {
    color: '#9f95a9',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#3d3548',
    margin: 0,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6b6375',
    margin: 0,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: '#6b6375',
    fontSize: 14,
  },
});

interface ReaderScreenProps {
  material: StudyMaterial;
  onBackToLibrary: () => void;
}

export default function ReaderScreen({ material, onBackToLibrary }: ReaderScreenProps) {
  const { data: document, isLoading, error } = useDocument(material);
  const documentId = material.id;
  const content = document?.content ?? '';

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

  const backAction = (
    <Button
      label="Back to Library"
      variant="secondary"
      icon={<ArrowLeft size={16} />}
      onClick={onBackToLibrary}
    >
      Back to Library
    </Button>
  );

  if (isLoading) {
    return (
      <Page title={material.title} actions={backAction}>
        <div {...stylex.props(styles.loading)}>Loading document...</div>
      </Page>
    );
  }

  if (error instanceof DocumentNotFoundError) {
    return (
      <Page title={material.title} actions={backAction}>
        <div {...stylex.props(styles.errorContainer)}>
          <div {...stylex.props(styles.errorIcon)}>
            <FileQuestion size={48} />
          </div>
          <h2 {...stylex.props(styles.errorTitle)}>Document could not be found.</h2>
          <p {...stylex.props(styles.errorSubtext)}>
            This material may have been moved or deleted.
          </p>
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title={material.title} actions={backAction}>
        <div {...stylex.props(styles.errorContainer)}>
          <h2 {...stylex.props(styles.errorTitle)}>Something went wrong.</h2>
          <p {...stylex.props(styles.errorSubtext)}>
            An unexpected error occurred while loading this document.
          </p>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title={material.title}
      actions={backAction}
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
