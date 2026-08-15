import { useCallback, useEffect, useState } from 'react';
import { routeToUrl, urlToRoute, type AppRoute } from './routing';

/**
 * Shell-owned route state (extracted from `AppShell`): parses the URL on
 * mount, syncs the URL on every navigation via `pushState`, and follows
 * browser back/forward via `popstate`.
 */
export function useAppRoute() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    const parsed = urlToRoute(window.location.pathname, window.location.search);
    return parsed ?? { kind: 'library' };
  });

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
        setCurrentRoute(parsed);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((route: AppRoute) => {
    setCurrentRoute(route);
  }, []);

  return { currentRoute, navigate };
}
