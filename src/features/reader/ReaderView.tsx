import { type RefObject } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { DrawingPath, AnnotationMode, DrawingTool, HighlightColor } from '../../domain/reader';
import type { PopoverState } from './types';
import MarkdownViewer from './components/MarkdownViewer';
import AnnotationToolbar from './components/AnnotationToolbar';
import DrawingCanvas from './components/DrawingCanvas';
import SelectionPopover from './components/SelectionPopover';
import { TocMobile, TocDesktop } from './components/Toc';

const dockQuery = '@media (max-width: 1023px)';

const styles = stylex.create({
  layout: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 32,
    width: '100%',
  },
  mainContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 32,
    flex: 1,
    minWidth: 0,
    [dockQuery]: {
      gap: 0,
    },
  },
  viewer: {
    position: 'relative',
    flex: 1,
    maxWidth: 800,
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
  // Popover props
  popover: PopoverState;
  onCreateHighlight: (color: HighlightColor) => void;
  onDeleteHighlight: () => void;
  onClosePopover: () => void;
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
            />
          </div>
        </div>
      </div>
      <TocDesktop content={content} />
    </div>
  );
}
