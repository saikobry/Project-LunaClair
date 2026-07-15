import { useState, useEffect, useRef, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import markdown from './content.md?raw';
import images from './images';
import Toc from './Toc';
import './App.css';

// Modular Annotation System Imports
import type { HighlightItem, DrawingPath, AnnotationMode, HighlightColor, DrawingTool } from './types';
import { getOffsetsOfRange, restoreRange } from './utils/selection';
import AnnotationToolbar from './components/AnnotationToolbar';
import DrawingCanvas from './components/DrawingCanvas';
import SelectionPopover from './components/SelectionPopover';

let content = markdown;
for (const [key, src] of Object.entries(images)) {
  content = content.replace(
    new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
    `<img src="${src}" alt="${key}" style="max-width:100%" />`
  );
}

const MemoizedMarkdown = memo(({ text }: { text: string }) => {
  return (
    <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSlug]} remarkPlugins={[remarkGfm]}>
      {text}
    </ReactMarkdown>
  );
});
MemoizedMarkdown.displayName = 'MemoizedMarkdown';

interface PopoverState {
  x: number;
  y: number;
  visible: boolean;
  targetHighlightId?: string;
  pendingSelection?: {
    start: number;
    end: number;
    text: string;
  };
}

function App() {
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);

  // States loaded from LocalStorage
  const [highlights, setHighlights] = useState<HighlightItem[]>(() => {
    const saved = localStorage.getItem('reviewer-highlights');
    return saved ? JSON.parse(saved) : [];
  });

  const [paths, setPaths] = useState<DrawingPath[]>(() => {
    const saved = localStorage.getItem('reviewer-paths');
    return saved ? JSON.parse(saved) : [];
  });

  // Editor states
  const [mode, setMode] = useState<AnnotationMode>('select');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('pen');
  const [brushColor, setBrushColor] = useState<string>('#ef4444');
  const [brushThickness, setBrushThickness] = useState<number>(4);
  const [popover, setPopover] = useState<PopoverState>({ x: 0, y: 0, visible: false });

  // Custom Highlights effect: Re-registers browser highlights when state changes
  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const css = (window as any).CSS;
    if (!css || !css.highlights) return;

    const colorGroups: Record<HighlightColor, Range[]> = {
      yellow: [],
      green: [],
      pink: [],
      blue: [],
    };

    highlights.forEach((hl) => {
      const range = restoreRange(container, hl.start, hl.end);
      if (range) {
        colorGroups[hl.color].push(range);
      }
    });

    (Object.keys(colorGroups) as HighlightColor[]).forEach((color) => {
      const groupName = `hl-${color}`;
      const ranges = colorGroups[color];
      if (ranges.length > 0) {
        css.highlights.set(groupName, new (window as any).Highlight(...ranges));
      } else {
        css.highlights.delete(groupName);
      }
    });
  }, [highlights]);

  // Prevent scrolling when in draw mode (especially on mobile)
  useEffect(() => {
    if (mode === 'draw') {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.body.style.overscrollBehavior = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.overscrollBehavior = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.overscrollBehavior = '';
    };
  }, [mode]);

  // Handle Selection Change Event
  const handleTextSelection = useCallback(() => {
    if (mode !== 'select') return;
    const container = viewerContainerRef.current;
    if (!container) return;

    const selection = window.getSelection();

    // 1. If selection is collapsed (regular click / cursor position)
    if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const offsets = getOffsetsOfRange(range, container);
        if (offsets) {
          // Check if cursor click falls inside any highlight
          const clickedHl = highlights.find(
            (hl) => offsets.start >= hl.start && offsets.start <= hl.end
          );
          if (clickedHl) {
            const rect = range.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            setPopover({
              x: rect.left + rect.width / 2 - containerRect.left,
              y: rect.top - containerRect.top,
              visible: true,
              targetHighlightId: clickedHl.id,
            });
            return;
          }
        }
      }

      // If we clicked elsewhere, close selection popover (but keep open if user is currently clicking the popover itself)
      setPopover((prev) => (prev.targetHighlightId ? { ...prev, visible: false, targetHighlightId: undefined } : prev));
      return;
    }

    // 2. If text selection exists (user selected a text range)
    const range = selection.getRangeAt(0);
    const offsets = getOffsetsOfRange(range, container);
    if (!offsets) return;

    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setPopover({
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top,
      visible: true,
      pendingSelection: {
        start: offsets.start,
        end: offsets.end,
        text: selection.toString(),
      },
    });
  }, [mode, highlights]);

  // Register selection listener
  useEffect(() => {
    const onSelectionChange = () => {
      handleTextSelection();
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [handleTextSelection]);

  // Actions
  const handleCreateHighlight = (color: HighlightColor) => {
    if (!popover.pendingSelection) return;

    const newHighlight: HighlightItem = {
      id: Math.random().toString(36).substring(2, 9),
      start: popover.pendingSelection.start,
      end: popover.pendingSelection.end,
      color,
      text: popover.pendingSelection.text,
    };

    const updated = [...highlights, newHighlight];
    setHighlights(updated);
    localStorage.setItem('reviewer-highlights', JSON.stringify(updated));

    // Clear UI text selection
    window.getSelection()?.removeAllRanges();

    // Close popover
    setPopover({ x: 0, y: 0, visible: false });
  };

  const handleDeleteHighlight = () => {
    if (!popover.targetHighlightId) return;

    const updated = highlights.filter((hl) => hl.id !== popover.targetHighlightId);
    setHighlights(updated);
    localStorage.setItem('reviewer-highlights', JSON.stringify(updated));

    setPopover({ x: 0, y: 0, visible: false });
  };

  const handlePathsChange = (newPaths: DrawingPath[]) => {
    setPaths(newPaths);
    localStorage.setItem('reviewer-paths', JSON.stringify(newPaths));
  };

  const handleUndo = () => {
    if (paths.length === 0) return;
    const updated = paths.slice(0, -1);
    handlePathsChange(updated);
  };

  const handleClearDrawings = () => {
    if (window.confirm('Are you sure you want to clear all drawings?')) {
      handlePathsChange([]);
    }
  };

  const handleClearHighlights = () => {
    if (window.confirm('Are you sure you want to clear all highlights?')) {
      setHighlights([]);
      localStorage.removeItem('reviewer-highlights');
    }
  };

  return (
    <div className="layout">
      <Toc />
      <div className="main-content-wrapper">
        <AnnotationToolbar
          mode={mode}
          onModeChange={setMode}
          tool={drawingTool}
          onToolChange={setDrawingTool}
          currentColor={brushColor}
          onColorChange={setBrushColor}
          brushThickness={brushThickness}
          onThicknessChange={setBrushThickness}
          onUndo={handleUndo}
          onClearDrawings={handleClearDrawings}
          onClearHighlights={handleClearHighlights}
          hasDrawings={paths.length > 0}
          hasHighlights={highlights.length > 0}
        />
        <div className="viewer-container">
          <div style={{ position: 'relative' }} ref={viewerContainerRef}>
            <div className="markdown-viewer">
              <MemoizedMarkdown text={content} />
            </div>
            <DrawingCanvas
              paths={paths}
              onPathsChange={handlePathsChange}
              active={mode === 'draw'}
              currentColor={brushColor}
              brushThickness={brushThickness}
              isEraser={drawingTool === 'eraser'}
            />
            <SelectionPopover
              x={popover.x}
              y={popover.y}
              visible={popover.visible}
              onSelectColor={handleCreateHighlight}
              onDelete={popover.targetHighlightId ? handleDeleteHighlight : undefined}
              onClose={() => setPopover({ x: 0, y: 0, visible: false })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
