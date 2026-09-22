import { useCallback, useEffect, useRef, useState } from 'react';
import { routeToUrl, urlToRoute, type AppRoute } from './routing';

/**
 * Shell-owned route state (extracted from `AppShell`): parses the URL on
 * mount, syncs the URL on every navigation via `pushState`, and follows
 * browser back/forward via `popstate`.
 *
 * Also tracks the previous in-app route so overlay-like screens (Settings)
 * can go back to the page they came from via `goBack` — with a Home fallback
 * when there is no in-app history (e.g. a deep link straight to `/settings`,
 * where a raw `history.back()` would eject the user from the app).
 */
export function useAppRoute() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    const parsed = urlToRoute(window.location.pathname, window.location.search);
    return parsed ?? { kind: 'home' };
  });

  const currentRef = useRef(currentRoute);
  const previousRef = useRef<AppRoute | null>(null);

  const recordTransition = useCallback((next: AppRoute) => {
    // Same-URL navigations (re-clicking the active destination) must not
    // poison the trail — backing out of them would loop onto the same page.
    if (routeToUrl(next) !== routeToUrl(currentRef.current)) {
      previousRef.current = currentRef.current;
    }
    currentRef.current = next;
    setCurrentRoute(next);
  }, []);

  // Sync URL when route changes
  useEffect(() => {
    const url = routeToUrl(currentRoute);
    window.history.pushState({ route: currentRoute }, '', url);
  }, [currentRoute]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (_e: PopStateEvent) => {
      const parsed = urlToRoute(window.location.pathname, window.location.search);
      if (parsed) {
        recordTransition(parsed);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [recordTransition]);

  const navigate = useCallback(
    (route: AppRoute) => {
      recordTransition(route);
    },
    [recordTransition],
  );

  const goBack = useCallback(() => {
    recordTransition(previousRef.current ?? { kind: 'home' });
  }, [recordTransition]);

  return { currentRoute, navigate, goBack };
}
