import { type RefObject } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { DrawingPath, AnnotationMode, DrawingTool, HighlightColor } from '../../../domain/reader/models/annotation.types';
import type { PopoverState } from '../types/reader.types';
import MarkdownViewer from './MarkdownViewer';
import AnnotationToolbar from './AnnotationToolbar';
import DrawingCanvas from './DrawingCanvas';
import SelectionPopover from './SelectionPopover';
import { TocMobile, TocDesktop } from './Toc';

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
  /** Object URLs for this document's stored assets, keyed by asset id (see `useMaterialAssets`). */
  assetUrls?: Map<string, string>;
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
  /** Hides the portaled annotation toolbar (workspace sets it off-Read). */
  toolbarHidden?: boolean;
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
  assetUrls,
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
  toolbarHidden,
}: ReaderViewProps) {
  return (
    <div {...stylex.props(styles.layout)}>
      <div {...stylex.props(styles.mainContent)}>
        <AnnotationToolbar
          mode={mode}
          onModeChange={onModeChange}
          hidden={toolbarHidden}
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
          <div style={{ position: 'relative' }}>
            <SelectionPopover
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
            {/*
              `containerRef` scopes the highlight character offsets: it wraps the
              rendered markdown ONLY, never the annotation chrome around it. The
              rail carries hidden Astryx tooltip text inside the DOM, which the
              offset walkers would count — shifting every highlight by the chrome's
              text length whenever the rail appeared or disappeared.
            */}
            <div ref={containerRef}>
              <MarkdownViewer text={content} assetUrls={assetUrls} />
            </div>
            <DrawingCanvas
              paths={paths}
              onPathsChange={onPathsChange}
              active={mode === 'draw'}
              currentColor={brushColor}
              brushThickness={brushThickness}
              isEraser={drawingTool === 'eraser'}
            />
          </div>
        </div>
      </div>
      <TocDesktop content={content} />
    </div>
  );
}
