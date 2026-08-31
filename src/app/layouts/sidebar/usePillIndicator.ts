import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface UsePillIndicatorParams {
  active: string;
  isSubjectActive: boolean;
  isMaterialActive: boolean;
  isFocusMode: boolean;
  hasSubject: boolean;
  hasMaterial: boolean;
}

/**
 * GSAP-driven sliding active pill indicator and item entrance transitions.
 */
export function usePillIndicator({
  active,
  isSubjectActive,
  isMaterialActive,
  isFocusMode,
  hasSubject,
  hasMaterial,
}: UsePillIndicatorParams) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);

  // ── Helper: reposition the sliding pill to match the active nav button ──
  const repositionPill = (animate = false) => {
    if (!wrapperRef.current || !pillRef.current) return;

    const activeItem = wrapperRef.current.querySelector('button[aria-current="page"]');
    if (!activeItem) {
      if (animate) {
        gsap.to(pillRef.current, { opacity: 0, duration: 0.15, overwrite: 'auto' });
      } else {
        gsap.set(pillRef.current, { opacity: 0 });
      }
      return;
    }

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const target = {
      left: itemRect.left - wrapperRect.left,
      top: itemRect.top - wrapperRect.top,
      width: itemRect.width,
      height: itemRect.height,
      opacity: 1,
    };

    if (animate) {
      gsap.to(pillRef.current, {
        ...target,
        duration: 0.32,
        ease: 'circ.out',
        overwrite: 'auto',
      });
    } else {
      gsap.set(pillRef.current, target);
    }
  };

  // ── Reposition whenever active route or mode changes ──────────
  useEffect(() => {
    requestAnimationFrame(() => repositionPill(true));
  }, [active, isSubjectActive, isMaterialActive, isFocusMode]);

  // ── Reposition on viewport resize (desktop ↔ tablet etc.) ──────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleResize = () => requestAnimationFrame(() => repositionPill(false));
    const ro = new ResizeObserver(handleResize);
    ro.observe(wrapper);

    return () => ro.disconnect();
  }, []);

  // ── Gentle entrance animation for nav items ───────────────────
  const didInitialEntrance = useRef(false);
  const prevHadSubject = useRef(false);
  const prevHadMaterial = useRef(false);

  useEffect(() => {
    const subjectJustAppeared = hasSubject && !prevHadSubject.current;
    const materialJustAppeared = hasMaterial && !prevHadMaterial.current;

    prevHadSubject.current = hasSubject;
    prevHadMaterial.current = hasMaterial;

    if (!sectionsRef.current) return;
    const items = sectionsRef.current.children;
    if (items.length === 0) return;

    if (!didInitialEntrance.current || subjectJustAppeared || materialJustAppeared) {
      didInitialEntrance.current = true;
      gsap.fromTo(
        items,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, stagger: 0.04, duration: 0.3, ease: 'power2.out', overwrite: 'auto' },
      );
    }
  }, [hasSubject, hasMaterial]);

  return { wrapperRef, pillRef, sectionsRef };
}
