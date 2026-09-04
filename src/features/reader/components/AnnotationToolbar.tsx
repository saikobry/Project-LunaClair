import { useState, useEffect, useRef, useLayoutEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  MousePointer,
  PenTool,
  Palette,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import type { AnnotationMode, DrawingTool } from '../../../domain/reader/models/annotation.types';
import { useFocusMode } from '../../../app/providers/FocusModeContext';
import { IconButton } from '../../../shared/ui/IconButton';
import { useDraggableToolbar } from '../hooks/useDraggableToolbar';
import { DrawingToolOptions } from './DrawingToolOptions';

const dockQuery = '@media (max-width: 1023px)';
const tabletQuery = '@media (min-width: 769px) and (max-width: 1023px)';
const mobileQuery = '@media (max-width: 768px)';

// The Focus Mode restore FAB occupies the bottom-left corner at
// `left: 16, width: 44` (x ∈ [16, 60]); 56 keeps a small tolerance.
const MOBILE_LEFT_COLLISION_BOUNDARY = 56;

const styles = stylex.create({
  // ── Glassmorphic dock (desktop: draggable floating vertical rail) ──
  // Transitions are scoped to non-transform props: GSAP owns the collapse
  // slide and the collapsible entrance so CSS never re-timelines its
  // per-frame writes.
  toolbar: {
    position: 'fixed',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '10px 8px',
    width: 48,
    boxSizing: 'border-box',
    backgroundColor: 'var(--color-background-surface, rgba(255, 255, 255, 0.95))',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border, rgba(229, 231, 235, 0.8))',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
    touchAction: 'none',
    userSelect: 'none',
    cursor: 'grab',
    transition:
      'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease',
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
      cursor: 'default',
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
  toolbarDragging: {
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
    transform: 'scale(1.02)',
    cursor: 'grabbing',
  },
  toolbarCollapsed: {
    padding: 8,
    boxShadow: '2px 2px 10px rgba(0, 0, 0, 0.05)',
    [dockQuery]: {
      padding: 8,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
    },
  },
  // Expanded with draw tools — wider to fit the 2-col color grid and
  // thickness pickers without crowding.
  toolbarDrawExpanded: {
    width: 64,
    padding: '12px 10px',
    [dockQuery]: {
      width: 'auto',
      padding: '8px 14px',
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

interface ToolbarCollapsibleProps {
  collapsibleRef: RefObject<HTMLDivElement | null>;
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

function ToggleGlyph({ isOpen, isMobileOrTablet }: { isOpen: boolean; isMobileOrTablet: boolean }) {
  if (!isOpen) return <Palette size={18} />;
  if (isMobileOrTablet) return <ChevronDown size={18} />;
  return <ChevronUp size={18} />;
}

function ToolbarCollapsible({
  collapsibleRef,
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
}: ToolbarCollapsibleProps) {
  return (
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
        <DrawingToolOptions
          tool={tool}
          onToolChange={onToolChange}
          currentColor={currentColor}
          onColorChange={onColorChange}
          brushThickness={brushThickness}
          onThicknessChange={onThicknessChange}
          onUndo={onUndo}
          hasDrawings={hasDrawings}
        />
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
  );
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

  const {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getPositionStyles,
  } = useDraggableToolbar(toolbarRef, isMobileOrTablet, focusMode);

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

      gsap.set(toolbar, { clearProps: 'transform' });

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

  const toolbarNode = (
    <div
      ref={toolbarRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={getPositionStyles()}
      {...stylex.props(
        styles.toolbar,
        !isOpen && styles.toolbarCollapsed,
        isOpen && mode === 'draw' && styles.toolbarDrawExpanded,
        focusMode && styles.toolbarFocus,
        isElevated && styles.toolbarElevated,
        isDragging && styles.toolbarDragging,
      )}
    >
      <IconButton
        variant="ghost"
        label={isOpen ? 'Collapse Toolbar' : 'Open Annotations'}
        tooltip={isOpen ? 'Collapse Toolbar' : 'Open Annotations'}
        icon={<ToggleGlyph isOpen={isOpen} isMobileOrTablet={isMobileOrTablet} />}
        aria-expanded={isOpen}
        onClick={handleToggle}
      />

      {isOpen && (
        <ToolbarCollapsible
          collapsibleRef={collapsibleRef}
          mode={mode}
          onModeChange={onModeChange}
          tool={tool}
          onToolChange={onToolChange}
          currentColor={currentColor}
          onColorChange={onColorChange}
          brushThickness={brushThickness}
          onThicknessChange={onThicknessChange}
          onUndo={onUndo}
          onClearDrawings={onClearDrawings}
          onClearHighlights={onClearHighlights}
          hasDrawings={hasDrawings}
          hasHighlights={hasHighlights}
        />
      )}
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(toolbarNode, document.body);
  }

  return toolbarNode;
}
