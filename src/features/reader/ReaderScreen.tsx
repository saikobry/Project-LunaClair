import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ArrowLeft } from 'lucide-react';
import type { Document } from '../../domain/reader';
import type { AnnotationMode, DrawingTool, HighlightColor } from '../../shared/types';
import { useHighlights, useDrawings, useTextSelection } from './hooks';
import { preprocessMarkdown } from './utils';
import ReaderView from './ReaderView';
import rawMarkdown from './assets/content.md?raw';

const processedContent = preprocessMarkdown(rawMarkdown);

const readerStyles = stylex.create({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 24px',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#e5e4e7',
    backgroundColor: '#fff',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: '#6b6375',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e4e7',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: '#f9fafb',
      color: '#08060d',
      borderColor: '#d1d5db',
    },
  },
  docTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#08060d',
    margin: 0,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

interface ReaderScreenProps {
  document: Document | null;
  onBackToLibrary: () => void;
}

export default function ReaderScreen({ document, onBackToLibrary }: ReaderScreenProps) {
  const {
    highlights,
    containerRef,
    addHighlight,
    deleteHighlight,
    clearHighlights,
  } = useHighlights();

  const [mode, setMode] = useState<AnnotationMode>('select');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('pen');
  const [brushColor, setBrushColor] = useState<string>('#ef4444');
  const [brushThickness, setBrushThickness] = useState<number>(4);

  const { paths, handlePathsChange, handleUndo, clearDrawings } = useDrawings(mode === 'draw');

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

  const content = document?.content ?? processedContent;

  return (
    <>
      {/* Top toolbar with back navigation */}
      <div {...stylex.props(readerStyles.toolbar)}>
        <button
          type="button"
          {...stylex.props(readerStyles.backButton)}
          onClick={onBackToLibrary}
        >
          <ArrowLeft size={16} />
          Back to Library
        </button>
        <h2 {...stylex.props(readerStyles.docTitle)}>
          {document?.title ?? 'Reader'}
        </h2>
      </div>

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
    </>
  );
}
