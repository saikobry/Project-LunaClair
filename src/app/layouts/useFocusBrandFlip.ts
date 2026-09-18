import { useLayoutEffect } from 'react';

/**
 * FLIP handoff for the Focus Mode brand logos.
 *
 * The mini capsule (`FocusModeBrand`) cannot live inside the sidebar or rail
 * — both hide their chrome in Focus Mode — so the handoff is choreographed
 * across components: the toggle handler captures the currently-visible logo
 * rects *before* flipping state (`captureBrandFlip`), and a layout effect
 * after render flies the incoming logo along the measured logo-to-logo
 * vector (`useFocusBrandFlip`). The rail brands keep their own fade, so the
 * combined effect is a travel + crossfade with never two solid logos.
 *
 * Graceful by construction: no WAAPI (`element.animate`) → the CSS
 * crossfade carries it; `prefers-reduced-motion` → no flight; mobile (no
 * visible tagged logo) → nothing captured, nothing played.
 */

const FLIP_DURATION_MS = 320;
const FLIP_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

/**
 * Brand-logo identity for the handoff. The JSX tags stay literals (the
 * repo's DOM-contract pattern — cf. the reorder hook's `data-drag-handle`),
 * but every *query* below goes through these builders so a rename touches
 * one place instead of silently breaking the flight.
 */
export type BrandLogoKey = 'sidebar' | 'rail' | 'fmbrand';

const brandLogoSelector = (key: BrandLogoKey): string => `[data-brand-logo="${key}"]`;
const BRAND_SOURCE_SELECTOR = '[data-brand-source]';
const BRAND_TARGET_SELECTOR = '[data-brand-target]';

interface BrandRects {
  sidebar?: DOMRect;
  rail?: DOMRect;
  fmbrand?: DOMRect;
}

/** Rects captured pre-toggle; consumed once by the post-render layout effect. */
let pendingRects: BrandRects | null = null;

/** In-flight WAAPI flights, so a rapid re-toggle cancels instead of stacking. */
let liveAnimations: Animation[] = [];

function cancelLiveAnimations() {
  for (const anim of liveAnimations) {
    try {
      anim.cancel();
    } catch {
      // Already finished or never started — nothing to cancel.
    }
  }
  liveAnimations = [];
}

/** Measures a tagged logo, or yields nothing when it is not laid out. */
function visibleLogoRect(key: BrandLogoKey): DOMRect | undefined {
  if (typeof document === 'undefined') return undefined;
  const el = document.querySelector(brandLogoSelector(key));
  if (!el) return undefined;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : undefined;
}

/** The rail brand button currently laid out (sidebar on desktop, rail on tablet). */
function visibleSourceButton(): Element | null {
  if (typeof document === 'undefined') return null;
  const buttons = Array.from(document.querySelectorAll(BRAND_SOURCE_SELECTOR));
  return buttons.find((el) => el.getBoundingClientRect().width > 0) ?? null;
}

/**
 * Captures the pre-toggle brand layout. Called from the focus toggle handler
 * — every entry (sidebar button, rail button, Cmd/Ctrl+B) funnels through
 * `useShellFocusMode`, so one capture point covers all of them.
 */
export function captureBrandFlip() {
  if (typeof document === 'undefined') return;
  cancelLiveAnimations();
  const rects: BrandRects = {};
  const sidebar = visibleLogoRect('sidebar');
  const rail = visibleLogoRect('rail');
  const fmbrand = visibleLogoRect('fmbrand');
  if (sidebar) rects.sidebar = sidebar;
  if (rail) rects.rail = rail;
  if (fmbrand) rects.fmbrand = fmbrand;
  pendingRects = rects;
}

function flyAlongVector(el: Element, deltaX: number, deltaY: number) {
  if (deltaX === 0 && deltaY === 0) return;
  const candidate = el as Element & { animate?: Element['animate'] };
  if (typeof candidate.animate !== 'function') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const anim = (el as HTMLElement).animate(
    [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: 'translate(0px, 0px)' }],
    { duration: FLIP_DURATION_MS, easing: FLIP_EASING },
  );
  liveAnimations.push(anim);
  anim.onfinish = () => {
    liveAnimations = liveAnimations.filter((a) => a !== anim);
  };
}

/**
 * Plays the captured handoff after the toggle renders. Must run in a layout
 * effect (pre-paint) so the flight starts from the fresh layout with no
 * one-frame flash at the destination.
 */
export function useFocusBrandFlip(isFocusMode: boolean) {
  useLayoutEffect(() => {
    const rects = pendingRects;
    pendingRects = null;
    if (!rects) return;

    if (isFocusMode) {
      // Entering: fly the mini capsule along the rail-logo → mini-logo vector.
      const from = rects.sidebar ?? rects.rail;
      const to = visibleLogoRect('fmbrand');
      const target = document.querySelector(BRAND_TARGET_SELECTOR);
      if (target && from && to) {
        flyAlongVector(target, from.left - to.left, from.top - to.top);
      }
    } else {
      // Exiting: fly the rail brand back along the same vector.
      const from = rects.fmbrand;
      const target = visibleSourceButton();
      const to = target ? target.getBoundingClientRect() : null;
      if (target && from && to && to.width > 0) {
        flyAlongVector(target, from.left - to.left, from.top - to.top);
      }
    }

    return () => {
      cancelLiveAnimations();
    };
  }, [isFocusMode]);
}
