import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MousePointer, Pencil, Eraser, Palette, ChevronLeft, Undo2, Trash2 } from 'lucide-react';
import type { AnnotationMode, DrawingTool } from '../../../shared/types';
import { BRUSH_COLORS, THICKNESS_OPTIONS } from '../../../shared/constants/annotationDefaults';

interface AnnotationToolbarProps {
  mode: AnnotationMode;
  onModeChange: (mode: AnnotationMode) => void;
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  brushThickness: number;
  onThicknessChange: (thickness: number) => void;
  onUndo: () => void;
  onClearDrawings: () => void;
  onClearHighlights: () => void;
  hasDrawings: boolean;
  hasHighlights: boolean;
}

function useIsMobileOrTablet() {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setIsMobileOrTablet(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isMobileOrTablet;
}

export default function AnnotationToolbar({
  mode,
  onModeChange,
  tool,
  onToolChange,
  currentColor,
  onColorChange,
  brushThickness,
  onThicknessChange,
  onUndo,
  onClearDrawings,
  onClearHighlights,
  hasDrawings,
  hasHighlights,
}: AnnotationToolbarProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const isMobileOrTablet = useIsMobileOrTablet();

  const toolbarNode = (
    <div className={`annotation-toolbar ${!isOpen ? 'collapsed' : ''}`}>
      <button
        type="button"
        className="toolbar-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Collapse Toolbar' : 'Open Annotations'}
        aria-label={isOpen ? 'Collapse Toolbar' : 'Open Annotations'}
      >
        {isOpen ? <ChevronLeft size={18} /> : <Palette size={18} />}
      </button>

      {isOpen && (
        <div className="toolbar-collapsible">
          <div className="toolbar-divider" />

          {/* Mode selectors */}
          <div className="toolbar-section">
            <button
              type="button"
              className={`toolbar-btn icon-only ${mode === 'select' ? 'active' : ''}`}
              onClick={() => onModeChange('select')}
              title="Select & Highlight Text"
            >
              <MousePointer size={18} />
            </button>
            <button
              type="button"
              className={`toolbar-btn icon-only ${mode === 'draw' ? 'active' : ''}`}
              onClick={() => onModeChange('draw')}
              title="Draw on Page"
            >
              <Pencil size={18} />
            </button>
          </div>

          {/* Sub-tools for drawing mode */}
          {mode === 'draw' && (
            <>
              <div className="toolbar-divider" />
              <div className="toolbar-section">
                <button
                  type="button"
                  className={`toolbar-btn icon-only ${tool === 'pen' ? 'active' : ''}`}
                  onClick={() => onToolChange('pen')}
                  title="Draw with Pen"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className={`toolbar-btn icon-only ${tool === 'eraser' ? 'active' : ''}`}
                  onClick={() => onToolChange('eraser')}
                  title="Erase strokes"
                >
                  <Eraser size={16} />
                </button>
              </div>

              {tool === 'pen' && (
                <>
                  <div className="toolbar-divider" />
                  <div className="toolbar-section color-section">
                    <div className="brush-colors">
                      {BRUSH_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          className={`brush-color-dot ${currentColor === color.hex ? 'active' : ''}`}
                          style={{ backgroundColor: color.hex }}
                          onClick={() => onColorChange(color.hex)}
                          title={color.name}
                          aria-label={`Brush color ${color.name}`}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="toolbar-divider" />
              <div className="toolbar-section size-section">
                <div className="brush-sizes">
                  {THICKNESS_OPTIONS.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`brush-size-btn ${brushThickness === size ? 'active' : ''}`}
                      onClick={() => onThicknessChange(size)}
                      title={`${size}px brush`}
                    >
                      <span
                        style={{
                          width: `${Math.max(4, size)}px`,
                          height: `${Math.max(4, size)}px`,
                          backgroundColor: 'currentColor',
                          borderRadius: '50%',
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="toolbar-divider" />
              <div className="toolbar-section action-section">
                <button
                  type="button"
                  className="toolbar-btn icon-only"
                  onClick={onUndo}
                  disabled={!hasDrawings}
                  title="Undo Last Stroke"
                  aria-label="Undo Last Stroke"
                >
                  <Undo2 size={18} />
                </button>
              </div>
            </>
          )}

          {/* Clear/Reset functions */}
          {(hasDrawings || hasHighlights) && (
            <>
              <div className="toolbar-divider" />
              <div className="toolbar-section action-section">
                {hasDrawings && (
                  <button
                    type="button"
                    className="toolbar-btn icon-only danger-btn"
                    onClick={onClearDrawings}
                    title="Clear all drawings"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {hasHighlights && (
                  <button
                    type="button"
                    className="toolbar-btn icon-only danger-btn"
                    onClick={onClearHighlights}
                    title="Clear all highlights"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );

  if (isMobileOrTablet && typeof document !== 'undefined') {
    return createPortal(toolbarNode, document.body);
  }

  return toolbarNode;
}
