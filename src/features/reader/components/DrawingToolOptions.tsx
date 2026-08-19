import * as stylex from '@stylexjs/stylex';
import { Pencil, Eraser, Undo2 } from 'lucide-react';
import type { DrawingTool } from '../../../domain/reader';
import { IconButton } from '../../../shared/ui/IconButton';
import { BRUSH_COLORS, THICKNESS_OPTIONS } from '../constants/annotationDefaults';

const dockQuery = '@media (max-width: 1023px)';

const styles = stylex.create({
  section: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    [dockQuery]: {
      flexDirection: 'row',
      gap: 4,
    },
  },
  divider: {
    width: 20,
    height: 1,
    backgroundColor: 'rgba(229, 231, 235, 1)',
    [dockQuery]: {
      width: 1,
      height: 16,
    },
  },
  brushColors: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 6,
    [dockQuery]: {
      display: 'flex',
      flexDirection: 'row',
      gap: 4,
    },
  },
  brushColorDot: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'transparent',
    cursor: 'pointer',
    padding: 0,
    transition:
      'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
    ':hover': {
      transform: 'scale(1.15)',
    },
  },
  brushColorDotActive: {
    borderColor: '#1f2937',
    transform: 'scale(1.15)',
    boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.8)',
  },
  brushSizes: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    [dockQuery]: {
      flexDirection: 'row',
      gap: 4,
    },
  },
  brushSizeBtn: {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    color: '#4b5563',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: '#f3f4f6',
    },
  },
  brushSizeBtnActive: {
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
    borderColor: '#d1d5db',
  },
  penIconWithDot: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  penColorDot: {
    position: 'absolute',
    right: -2,
    bottom: -1,
    width: 8,
    height: 8,
    borderRadius: '50%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.95)',
    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.2)',
  },
});

interface DrawingToolOptionsProps {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  brushThickness: number;
  onThicknessChange: (thickness: number) => void;
  onUndo: () => void;
  hasDrawings: boolean;
}

export function DrawingToolOptions({
  tool,
  onToolChange,
  currentColor,
  onColorChange,
  brushThickness,
  onThicknessChange,
  onUndo,
  hasDrawings,
}: DrawingToolOptionsProps) {
  return (
    <>
      <div {...stylex.props(styles.divider)} />
      <div {...stylex.props(styles.section)}>
        <IconButton
          variant={tool === 'pen' ? 'primary' : 'ghost'}
          label="Draw with Pen"
          tooltip="Draw with Pen"
          icon={
            <span {...stylex.props(styles.penIconWithDot)}>
              <Pencil size={16} />
              <span
                aria-hidden="true"
                {...stylex.props(styles.penColorDot)}
                style={{ backgroundColor: currentColor }}
              />
            </span>
          }
          onClick={() => onToolChange('pen')}
        />
        <IconButton
          variant={tool === 'eraser' ? 'primary' : 'ghost'}
          label="Erase strokes"
          tooltip="Erase strokes"
          icon={<Eraser size={16} />}
          onClick={() => onToolChange('eraser')}
        />
      </div>

      {tool === 'pen' && (
        <>
          <div {...stylex.props(styles.divider)} />
          <div {...stylex.props(styles.section)}>
            <div {...stylex.props(styles.brushColors)}>
              {BRUSH_COLORS.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  {...stylex.props(
                    styles.brushColorDot,
                    currentColor === color.hex && styles.brushColorDotActive,
                  )}
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

      <div {...stylex.props(styles.divider)} />
      <div {...stylex.props(styles.section)}>
        <div {...stylex.props(styles.brushSizes)}>
          {THICKNESS_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              {...stylex.props(
                styles.brushSizeBtn,
                brushThickness === size && styles.brushSizeBtnActive,
              )}
              onClick={() => onThicknessChange(size)}
              title={`${size}px brush`}
              aria-label={`${size}px brush`}
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

      <div {...stylex.props(styles.divider)} />
      <div {...stylex.props(styles.section)}>
        <IconButton
          variant="ghost"
          label="Undo Last Stroke"
          tooltip="Undo Last Stroke"
          icon={<Undo2 size={18} />}
          isDisabled={!hasDrawings}
          onClick={onUndo}
        />
      </div>
    </>
  );
}
