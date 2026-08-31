import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * GSAP-driven sidebar collapse morph into/out of the bottom-left restore corner.
 */
export function useFocusModeMorph(isFocusMode: boolean) {
  const navRef = useRef<HTMLElement>(null);
  const didInitialFocusAnim = useRef(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Shrink into (or expand out of) the bottom-left corner, matching the
    // floating logo restore button position. The desktop sidebar is
    // edge-to-edge, so anchor the morph at the restore button's center;
    // the tablet rail and mobile bottom bar already touch that corner.
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isTablet = window.matchMedia('(min-width: 769px) and (max-width: 1023px)').matches;
    const origin = isMobile || isTablet ? 'left bottom' : '38px calc(100% - 38px)';

    const hidden = {
      autoAlpha: 0,
      scale: 0.05,
      transformOrigin: origin,
      pointerEvents: 'none',
    };
    const visible = {
      autoAlpha: 1,
      scale: 1,
      transformOrigin: origin,
      pointerEvents: 'auto',
    };

    if (!didInitialFocusAnim.current) {
      didInitialFocusAnim.current = true;
      // Set (never animate) on first paint so a persisted Focus Mode
      // never flashes the rail before hiding.
      gsap.set(nav, isFocusMode ? hidden : visible);
      return;
    }

    gsap.to(nav, {
      ...(isFocusMode ? hidden : visible),
      duration: 0.35,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
  }, [isFocusMode]);

  return navRef;
}
