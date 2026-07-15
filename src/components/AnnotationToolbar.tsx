import { useState } from 'react';
import { MousePointer, Pencil, Eraser, Palette, ChevronLeft, Undo2, Trash2 } from 'lucide-react';
import type { AnnotationMode, DrawingTool } from '../types';

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

const BRUSH_COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Black', hex: '#1f2937' },
];

const THICKNESS_OPTIONS = [2, 4, 8, 12];

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

  return (
    <div className={`annotation-toolbar ${!isOpen ? 'collapsed' : ''}`}>
      <button
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
              className={`toolbar-btn icon-only ${mode === 'select' ? 'active' : ''}`}
              onClick={() => onModeChange('select')}
              title="Select & Highlight Text"
            >
              <MousePointer size={18} />
            </button>
            <button
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
                  className={`toolbar-btn icon-only ${tool === 'pen' ? 'active' : ''}`}
                  onClick={() => onToolChange('pen')}
                  title="Draw with Pen"
                >
                  <Pencil size={16} />
                </button>
                <button
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
                    className="toolbar-btn icon-only danger-btn"
                    onClick={onClearDrawings}
                    title="Clear all drawings"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {hasHighlights && (
                  <button
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
}
