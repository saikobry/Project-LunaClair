/**
 * PWA install-surface detection helpers (app-shell chrome).
 *
 * LunaClair is an installable offline PWA, but installability is surfaced
 * natively only on Chromium (address-bar icon, Android menu). iOS Safari has
 * no install affordance at all — "Add to Home Screen" is the only path and
 * nothing in the UI suggests it. These helpers drive the opt-in sidebar
 * entry plus the iOS-only one-time install card (see `InstallPrompt.tsx`).
 */

/** True on iOS (iPhone/iPad/iPod), including iPadOS 13+ which reports a macOS UA. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ masquerades as macOS in the UA — the touch-points heuristic
  // is the standard way to catch it (desktop Macs report 0–1 touch points).
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/** True while the app runs as an installed PWA (standalone window). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS legacy signal (non-standard, but still reported by Safari).
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
