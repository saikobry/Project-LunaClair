import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ArrowLeft, FileQuestion, BrainCircuit, ClipboardList } from 'lucide-react';
import type { QuizLaunchRequest } from '../quiz/types/quizFeature.types';
import { DocumentNotFoundError } from '../../domain/reader/DocumentNotFoundError';
import type { AnnotationMode, DrawingTool, HighlightColor } from '../../shared/types';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button';
import { ConfirmationDialog } from '../../shared/ui/Dialog/ConfirmationDialog';
import { useMaterial } from '../../shared/hooks/useMaterial';
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
  materialId: string;
  onBackToLibrary: () => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
  onManageQuiz: (materialId: string) => void;
}

export default function ReaderScreen({ materialId, onBackToLibrary, onStartQuiz, onManageQuiz }: ReaderScreenProps) {
  const { material, isLoading: materialLoading } = useMaterial(materialId);
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
    } else if (confirmTarget === 'highlights') {
      clearHighlights();
    }
    setConfirmTarget(null);
  }, [confirmTarget, clearDrawings, clearHighlights]);

  const isLoading = materialLoading || docLoading;

  const backAction = (
    <>
      <Button
        label="Back to Library"
        variant="secondary"
        icon={<ArrowLeft size={16} />}
        onClick={onBackToLibrary}
      >
        Back to Library
      </Button>
      {material && (
        <>
          <Button
            label="Question Bank"
            variant="secondary"
            icon={<ClipboardList size={16} />}
            onClick={() => onManageQuiz(material.id)}
          >
            Question Bank
          </Button>
          <Button
            label="Take Quiz"
            variant="primary"
            icon={<BrainCircuit size={16} />}
            onClick={() => onStartQuiz({ materialId: material.id, source: 'reader' })}
          >
            Take Quiz
          </Button>
        </>
      )}
    </>
  );

  const pageTitle = material?.title ?? 'Loading…';

  if (isLoading) {
    return (
      <Page title={pageTitle} actions={backAction}>
        <div {...stylex.props(styles.loading)}>Loading document...</div>
      </Page>
    );
  }

  if (!material) {
    return (
      <Page title="Material not found" actions={backAction}>
        <div {...stylex.props(styles.errorContainer)}>
          <div {...stylex.props(styles.errorIcon)}>
            <FileQuestion size={48} />
          </div>
          <h2 {...stylex.props(styles.errorTitle)}>Material could not be found.</h2>
        </div>
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

      {/* Confirmation dialogs replacing window.confirm */}
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
    </Page>
  );
}
