import { useState, useEffect, useRef, useLayoutEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  MousePointer,
  PenTool,
  Pencil,
  Eraser,
  Palette,
  ChevronLeft,
  ChevronDown,
  Undo2,
  Trash2,
} from 'lucide-react';
import type { AnnotationMode, DrawingTool } from '../../../domain/reader';
import { useFocusMode } from '../../../app/providers/FocusModeContext';
import { IconButton } from '../../../shared/ui/IconButton';
import { BRUSH_COLORS, THICKNESS_OPTIONS } from '../constants/annotationDefaults';

const dockQuery = '@media (max-width: 1023px)';
const tabletQuery = '@media (min-width: 769px) and (max-width: 1023px)';
const mobileQuery = '@media (max-width: 768px)';

// The Focus Mode restore FAB occupies the bottom-left corner at
// `left: 16, width: 44` (x ∈ [16, 60]); 56 keeps a small tolerance.
const MOBILE_LEFT_COLLISION_BOUNDARY = 56;

const styles = stylex.create({
  // ── Glassmorphic dock (desktop: sticky vertical rail) ──
  // Transitions are scoped to non-transform props: GSAP owns the collapse
  // slide and the collapsible entrance so CSS never re-timelines its
  // per-frame writes.
  toolbar: {
    position: 'sticky',
    top: 100,
    alignSelf: 'flex-start',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '12px 10px',
    width: 64,
    boxSizing: 'border-box',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(229, 231, 235, 0.8)',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
    transition:
      'padding 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease',
    // Tablet & mobile: centered bottom dock
    [dockQuery]: {
      position: 'fixed',
      left: '50%',
      top: 'auto',
      width: 'auto',
      transform: 'translateX(-50%)',
      flexDirection: 'row',
      gap: 6,
      padding: '8px 14px',
      borderRadius: 16,
      borderLeftWidth: 1,
      borderLeftStyle: 'solid',
      borderLeftColor: 'rgba(229, 231, 235, 0.8)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
    },
    [tabletQuery]: {
      bottom: 24,
    },
    // Mobile: elevated above the app bottom nav. The dock is capped to the
    // viewport width; the collapsible content wraps into multiple rows on
    // mobile (see `collapsible`), and any remaining excess scrolls within
    // the dock (no visible scrollbar on touch devices; Firefox uses
    // scrollbarWidth: none).
    [mobileQuery]: {
      bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
      transition:
        'padding 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.35s ease',
      // Stays under the Focus Mode restore FAB (zIndex 150) so the logo
      // button always remains reachable in Focus Mode.
      zIndex: 149,
      maxWidth: 'calc(100vw - 32px)',
      overflowX: 'auto',
      scrollbarWidth: 'none',
    },
  },
  toolbarCollapsed: {
    transform: 'translateX(calc(-100% + 44px))',
    padding: 10,
    boxShadow: '2px 2px 10px rgba(0, 0, 0, 0.05)',
    [dockQuery]: {
      transform: 'translateX(-50%)',
      padding: 8,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
    },
  },
  // Focus Mode (mobile): drop the dock to the bottom edge
  toolbarFocus: {
    [mobileQuery]: {
      bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
    },
  },
  // Collision avoidance (mobile, Focus Mode): the dock drops to the bottom
  // edge where an expanded dock can overlap the restore FAB (z 150). Lift it
  // just clear of the FAB's top edge (`bottom: 16px` + 44px height ≈ 60px) —
  // 72px keeps ~12px clearance without launching the dock up the screen.
  // Gated by `focusMode` in useMobileDockCollision.
  toolbarElevated: {
    [mobileQuery]: {
      bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
    },
  },
  collapsible: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    [dockQuery]: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      // Keeps the rightmost tool clear of the dock's rounded edge in the
      // rare case content still overflows (safety net; see mobile wrap).
      paddingRight: 6,
    },
    // Mobile: pack the wide draw-mode dock into multiple centered rows
    // instead of one overflowing scroll line, so Undo/Clear are never
    // clipped against the rounded corner.
    [mobileQuery]: {
      flexWrap: 'wrap',
      justifyContent: 'center',
      minWidth: 0,
    },
  },
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
  // Brush color swatches
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
  // Brush thickness pickers
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
  // Current-brush color indicator dot on the "Draw with Pen" sub-tool.
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
  /** Overrides the Focus Mode state from context when provided. */
  isFocusMode?: boolean;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * Detects when the expanded bottom dock would collide with the Focus Mode
 * restore FAB on mobile and reports whether the dock should be elevated.
 * Only Focus Mode drops the dock to the bottom edge (`bottom: 16px`) where
 * it can reach the FAB zone — the resting `bottom: 84px` is already clear of
 * the nav, so `isFocusMode` alone gates the elevation (and is immune to
 * `env(safe-area-inset-bottom)` shifting the dock's measured position).
 */
function useMobileDockCollision(
  toolbarRef: RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  isMobile: boolean,
  isFocusMode: boolean,
) {
  const [isElevated, setIsElevated] = useState(false);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || !isMobile || !isOpen) {
      setIsElevated(false);
      return;
    }

    const check = () => {
      const rect = toolbar.getBoundingClientRect();
      const overlapsLeftChrome = rect.left < MOBILE_LEFT_COLLISION_BOUNDARY;
      setIsElevated(isFocusMode && overlapsLeftChrome);
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(toolbar);
    window.addEventListener('resize', check);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [toolbarRef, isOpen, isMobile, isFocusMode]);

  return isElevated;
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
  isFocusMode,
}: AnnotationToolbarProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const isMobileOrTablet = useMediaQuery('(max-width: 1023px)');
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isFocusMode: contextIsFocusMode } = useFocusMode();
  const focusMode = isFocusMode ?? contextIsFocusMode;

  const toolbarRef = useRef<HTMLDivElement>(null);
  const collapsibleRef = useRef<HTMLDivElement>(null);
  const exitTweenRef = useRef<gsap.core.Tween | null>(null);
  const isElevated = useMobileDockCollision(toolbarRef, isOpen, isMobile, focusMode);

  // Close plays a quick content exit before unmounting; open just flips state
  // and lets the GSAP entrance below animate the fresh content in.
  const handleToggle = () => {
    if (isOpen) {
      exitTweenRef.current?.kill();
      const collapsible = collapsibleRef.current;
      if (collapsible) {
        exitTweenRef.current = gsap.to(collapsible, {
          autoAlpha: 0,
          scale: 0.95,
          y: 6,
          duration: 0.18,
          ease: 'power2.in',
          onComplete: () => {
            exitTweenRef.current = null;
            setIsOpen(false);
          },
        });
      } else {
        setIsOpen(false);
      }
    } else {
      exitTweenRef.current?.kill();
      setIsOpen(true);
    }
  };

  // GSAP owns the dock collapse slide (desktop) and the collapsible content
  // entrance. On the dock (tablet/mobile) the CSS `translateX(-50%)`
  // centering must stay untouched, so transforms are cleared there.
  useGSAP(
    () => {
      const toolbar = toolbarRef.current;
      if (!toolbar) return;

      if (isMobileOrTablet) {
        gsap.set(toolbar, { clearProps: 'transform' });
      } else {
        gsap.to(toolbar, {
          x: isOpen ? 0 : -(toolbar.offsetWidth - 44),
          duration: 0.35,
          ease: isOpen ? 'back.out(1.5)' : 'power2.inOut',
          overwrite: 'auto',
        });
      }

      if (isOpen && collapsibleRef.current) {
        gsap.fromTo(
          collapsibleRef.current,
          { autoAlpha: 0, scale: 0.92, y: 6 },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: 0.3,
            ease: 'back.out(1.7)',
            overwrite: 'auto',
          },
        );
      }
    },
    { scope: toolbarRef, dependencies: [isOpen, isMobileOrTablet] },
  );

  // Active tool buttons use the `primary` (filled) variant; the collapse
  // toggle and standard actions stay `ghost`. Clear/reset actions use the
  // `danger` (destructive) variant. The collapse chevron points into the
  // dock (left on desktop, down on tablet/mobile) — no CSS rotation.
  const toggleIcon = isOpen ? (
    isMobileOrTablet ? (
      <ChevronDown size={18} />
    ) : (
      <ChevronLeft size={18} />
    )
  ) : (
    <Palette size={18} />
  );

  const toolbarNode = (
    <div
      ref={toolbarRef}
      {...stylex.props(
        styles.toolbar,
        !isOpen && styles.toolbarCollapsed,
        focusMode && styles.toolbarFocus,
        isElevated && styles.toolbarElevated,
      )}
    >
      <IconButton
        variant="ghost"
        label={isOpen ? 'Collapse Toolbar' : 'Open Annotations'}
        tooltip={isOpen ? 'Collapse Toolbar' : 'Open Annotations'}
        icon={toggleIcon}
        aria-expanded={isOpen}
        onClick={handleToggle}
      />

      {isOpen && (
        <div ref={collapsibleRef} {...stylex.props(styles.collapsible)}>
          <div {...stylex.props(styles.divider)} />

          {/* Mode selectors */}
          <div {...stylex.props(styles.section)}>
            <IconButton
              variant={mode === 'select' ? 'primary' : 'ghost'}
              label="Select & Highlight Text"
              tooltip="Select & Highlight Text"
              icon={<MousePointer size={18} />}
              onClick={() => onModeChange('select')}
            />
            <IconButton
              variant={mode === 'draw' ? 'primary' : 'ghost'}
              label="Draw on Page"
              tooltip="Draw on Page"
              icon={<PenTool size={18} />}
              onClick={() => onModeChange('draw')}
            />
          </div>

          {/* Sub-tools for drawing mode */}
          {mode === 'draw' && (
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
          )}

          {/* Clear/Reset functions */}
          {(hasDrawings || hasHighlights) && (
            <>
              <div {...stylex.props(styles.divider)} />
              <div {...stylex.props(styles.section)}>
                {hasDrawings && (
                  <IconButton
                    variant="danger"
                    label="Clear all drawings"
                    tooltip="Clear all drawings"
                    icon={<Trash2 size={16} />}
                    onClick={onClearDrawings}
                  />
                )}
                {hasHighlights && (
                  <IconButton
                    variant="danger"
                    label="Clear all highlights"
                    tooltip="Clear all highlights"
                    icon={<Trash2 size={16} />}
                    onClick={onClearHighlights}
                  />
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
