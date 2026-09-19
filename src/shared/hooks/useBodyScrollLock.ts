import { useEffect } from 'react';

/**
 * Locks `document.body` scroll while `isActive`, so the page behind an overlay
 * cannot scroll under it.
 *
 * Restores whatever `overflow` the body already carried rather than resetting to
 * `''`, so nesting or an app-level body style is never clobbered on release.
 *
 * This is the single implementation behind every surface that locks the page:
 * modal `<dialog>`s through `useModalDialog`, and non-modal overlays such as the
 * AI assistant drawer, which owns its own backdrop instead of relying on the
 * platform's top layer.
 */
export function useBodyScrollLock(isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isActive]);
}
