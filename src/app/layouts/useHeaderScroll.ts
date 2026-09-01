import { useState, useEffect } from 'react';

/**
 * Tracks window scroll depth with hysteresis to smoothly toggle compact header mode.
 * Uses requestAnimationFrame to throttle updates and prevent layout thrashing.
 */
export function useHeaderScroll(threshold = 28, restoreThreshold = 10): boolean {
  const [isScrolled, setIsScrolled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.scrollY > threshold;
  });

  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const currentY = window.scrollY;

        setIsScrolled((prev) => {
          if (!prev && currentY > threshold) {
            return true;
          }
          if (prev && currentY < restoreThreshold) {
            return false;
          }
          return prev;
        });
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [threshold, restoreThreshold]);

  return isScrolled;
}
