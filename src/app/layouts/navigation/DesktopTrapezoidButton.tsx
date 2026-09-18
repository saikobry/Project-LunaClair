import { useState, useRef, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Focus } from 'lucide-react';
import gsap from 'gsap';
import { styles } from './desktopSidebar.stylex';

export interface DesktopTrapezoidButtonProps {
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}

// Top corners rounded (~12px radius feel), bottom edges 100% straight and sharp
const SHARP_BOTTOM_TRAPEZOID = 'M 24 0 L 216 0 C 224 0 234 16 240 58 L 0 58 C 6 16 16 0 24 0 Z';
const SHARP_BOTTOM_SQUARE = 'M 14 0 L 226 0 C 234 0 240 6 240 58 L 0 58 C 0 6 6 0 14 0 Z';

export function DesktopTrapezoidButton({
  isFocusMode,
  onToggleFocusMode,
}: DesktopTrapezoidButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const backdropPathRef = useRef<SVGPathElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);
  const labelGroupRef = useRef<HTMLDivElement>(null);
  const shortcutRef = useRef<HTMLDivElement>(null);
  const didInitialMorph = useRef(false);

  useEffect(() => {
    const btn = buttonRef.current;
    const backdropPath = backdropPathRef.current;
    const content = contentRef.current;
    const icon = iconRef.current;
    const labelGroup = labelGroupRef.current;
    const shortcut = shortcutRef.current;
    if (!btn || !backdropPath || !content || !icon || !labelGroup || !shortcut) return;

    const expandedState = {
      x: 0,
      y: 0,
      width: 240,
      height: 58,
      backgroundColor: 'transparent',
      boxShadow: '0 0 0 rgba(0,0,0,0)',
      borderWidth: 0,
    };

    const collapsedState = {
      x: 16,
      y: -16,
      width: 44,
      height: 44,
      borderRadius: '14px',
      backgroundColor: 'var(--color-background-surface)',
      boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.18)',
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: 'var(--color-border)',
    };

    const iconCollapsedPos = { x: 5.8, y: 0 };
    const iconExpandedPos = { x: 0, y: 0 };

    if (!didInitialMorph.current) {
      didInitialMorph.current = true;
      if (isFocusMode) {
        gsap.set(btn, collapsedState);
        gsap.set(backdropPath, { autoAlpha: 0, attr: { d: SHARP_BOTTOM_SQUARE } });
        gsap.set([labelGroup, shortcut], { autoAlpha: 0, display: 'none' });
        gsap.set(content, { width: 44, height: 44, padding: 0 });
        gsap.set(icon, iconCollapsedPos);
      } else {
        gsap.set(btn, expandedState);
        gsap.set(backdropPath, { autoAlpha: 1, attr: { d: SHARP_BOTTOM_TRAPEZOID } });
        gsap.set([labelGroup, shortcut], { autoAlpha: 1, display: 'flex' });
        gsap.set(content, { width: 240, height: 58, paddingLeft: 24, paddingRight: 24, paddingTop: 14, paddingBottom: 6 });
        gsap.set(icon, iconExpandedPos);
      }
      return;
    }

    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

    if (isFocusMode) {
      tl.to([labelGroup, shortcut], {
        autoAlpha: 0,
        duration: 0.12,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set([labelGroup, shortcut], { display: 'none' });
        },
      }, 0);

      tl.to(backdropPath, {
        attr: { d: SHARP_BOTTOM_SQUARE },
        autoAlpha: 0,
        duration: 0.24,
        ease: 'power2.inOut',
      }, 0);

      tl.to(icon, {
        ...iconCollapsedPos,
        duration: 0.28,
        ease: 'power2.out',
      }, 0.04);

      tl.to(btn, {
        ...collapsedState,
        duration: 0.28,
        ease: 'power2.out',
      }, 0.04);

      tl.to(content, {
        width: 44,
        height: 44,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        duration: 0.28,
        ease: 'power2.out',
      }, 0.04);
    } else {
      tl.to(btn, {
        ...expandedState,
        duration: 0.28,
        ease: 'power3.out',
      }, 0);

      tl.to(content, {
        width: 240,
        height: 58,
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 14,
        paddingBottom: 6,
        duration: 0.28,
        ease: 'power3.out',
      }, 0);

      tl.to(icon, {
        ...iconExpandedPos,
        duration: 0.28,
        ease: 'power3.out',
      }, 0);

      tl.to(backdropPath, {
        attr: { d: SHARP_BOTTOM_TRAPEZOID },
        autoAlpha: 1,
        duration: 0.24,
        ease: 'power2.inOut',
      }, 0.06);

      gsap.set([labelGroup, shortcut], { display: 'flex' });
      tl.fromTo([labelGroup, shortcut],
        { autoAlpha: 0, y: 4 },
        { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out' },
        0.12
      );
    }
  }, [isFocusMode]);

  return (
    <div {...stylex.props(styles.footerWrapper)}>
      <button
        ref={buttonRef}
        type="button"
        {...stylex.props(
          styles.trapezoidButton,
          isHovered && styles.trapezoidButtonHover,
          isFocusMode && styles.focusModeButton,
        )}
        onClick={onToggleFocusMode}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
        title={isFocusMode ? 'Exit Focus Mode (Cmd/Ctrl+B)' : 'Enter Focus Mode (Cmd/Ctrl+B)'}
      >
        <svg {...stylex.props(styles.trapezoidSvgBackdrop)} viewBox="0 0 240 58" preserveAspectRatio="none">
          <path
            ref={backdropPathRef}
            {...stylex.props(
              styles.backdropPath,
              isHovered && !isFocusMode && styles.backdropPathHover,
            )}
          />
        </svg>

        <div ref={contentRef} {...stylex.props(styles.buttonContent)}>
          <Focus
            ref={iconRef}
            size={isFocusMode ? 20 : 16}
            {...stylex.props(styles.focusIcon)}
            aria-hidden="true"
          />
          <div ref={labelGroupRef} {...stylex.props(styles.labelGroup)}>
            <span {...stylex.props(styles.focusLabel)}>Focus Mode</span>
          </div>
          <div ref={shortcutRef} {...stylex.props(styles.shortcutRow)}>
            <kbd {...stylex.props(styles.kbd)}>Cmd+B</kbd>
          </div>
        </div>
      </button>
    </div>
  );
}
