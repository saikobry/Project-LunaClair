import { type RefObject } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { DrawingPath, AnnotationMode, DrawingTool, HighlightColor } from '../../domain/reader/models/annotation.types';
import type { PopoverState } from './types/reader.types';
import MarkdownViewer from './components/MarkdownViewer';
import AnnotationToolbar from './components/AnnotationToolbar';
import DrawingCanvas from './components/DrawingCanvas';
import SelectionPopover from './components/SelectionPopover';
import { TocMobile, TocDesktop } from './components/Toc';

const styles = stylex.create({
  layout: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  mainContent: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
  },

  viewer: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    width: '100%',
    maxWidth: 800,
    boxSizing: 'border-box',
    overflow: 'clip',
  },
});

interface ReaderViewProps {
  content: string;
  containerRef: RefObject<HTMLDivElement | null>;
  // Annotation toolbar props
  mode: AnnotationMode;
  onModeChange: (mode: AnnotationMode) => void;
  drawingTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  brushColor: string;
  onColorChange: (color: string) => void;
  brushThickness: number;
  onThicknessChange: (thickness: number) => void;
  onUndo: () => void;
  onClearDrawings: () => void;
  onClearHighlights: () => void;
  hasDrawings: boolean;
  hasHighlights: boolean;
  // Drawing canvas props
  paths: DrawingPath[];
  onPathsChange: (paths: DrawingPath[]) => void;
  // Highlight popover props
  popover: PopoverState;
  onCreateHighlight: (color: HighlightColor) => void;
  onDeleteHighlight: () => void;
  onClosePopover: () => void;
  onAskAiSelection?: (action: 'explain' | 'simplify' | 'example', text: string) => void;
}

export default function ReaderView({
  content,
  containerRef,
  mode,
  onModeChange,
  drawingTool,
  onToolChange,
  brushColor,
  onColorChange,
  brushThickness,
  onThicknessChange,
  onUndo,
  onClearDrawings,
  onClearHighlights,
  hasDrawings,
  hasHighlights,
  paths,
  onPathsChange,
  popover,
  onCreateHighlight,
  onDeleteHighlight,
  onClosePopover,
  onAskAiSelection,
}: ReaderViewProps) {
  return (
    <div {...stylex.props(styles.layout)}>
      <div {...stylex.props(styles.mainContent)}>
        <AnnotationToolbar
          mode={mode}
          onModeChange={onModeChange}
          tool={drawingTool}
          onToolChange={onToolChange}
          currentColor={brushColor}
          onColorChange={onColorChange}
          brushThickness={brushThickness}
          onThicknessChange={onThicknessChange}
          onUndo={onUndo}
          onClearDrawings={onClearDrawings}
          onClearHighlights={onClearHighlights}
          hasDrawings={hasDrawings}
          hasHighlights={hasHighlights}
        />
        <div {...stylex.props(styles.viewer)}>
          <TocMobile content={content} />
          <div style={{ position: 'relative' }} ref={containerRef}>
            <MarkdownViewer text={content} />
            <DrawingCanvas
              paths={paths}
              onPathsChange={onPathsChange}
              active={mode === 'draw'}
              currentColor={brushColor}
              brushThickness={brushThickness}
              isEraser={drawingTool === 'eraser'}
            />
            <SelectionPopover
              x={popover.x}
              y={popover.y}
              visible={popover.visible}
              onSelectColor={onCreateHighlight}
              onDelete={popover.targetHighlightId ? onDeleteHighlight : undefined}
              onClose={onClosePopover}
              onAskAi={
                onAskAiSelection
                  ? (action) => {
                      const text = popover.pendingSelection?.text || '';
                      if (text) {
                        onAskAiSelection(action, text);
                      }
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>
      <TocDesktop content={content} />
    </div>
  );
}
