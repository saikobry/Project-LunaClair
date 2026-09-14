/**
 * App routing — the `AppRoute` union and its URL serialization.
 *
 * Defines the public navigation contracts consumed by AppShell,
 * the router view dispatcher, and feature components.
 */
import {
  isMaterialMembershipFilter,
  type MaterialMembershipFilter,
} from '../../features/materials/types/libraryFilter.types';

export type { MaterialMembershipFilter };

/**
 * Library view mode — which slice of `/library` is on screen.
 *
 * - `overview`    — capped Collections shelf above capped materials (the default)
 * - `collections` — full collections browser with search
 * - `materials`   — full materials section with search/tag/membership filters
 *
 * App-owned (it shapes the route, not a feature list); `LibraryScreen` consumes
 * it the same way it consumes the membership lens.
 */
export type LibraryViewMode = 'overview' | 'collections' | 'materials';

export const LIBRARY_VIEW_MODES: readonly LibraryViewMode[] = [
  'overview',
  'collections',
  'materials',
];

/** Narrows an untrusted query-string value to a valid view mode. */
export function isLibraryViewMode(value: unknown): value is LibraryViewMode {
  return value === 'overview' || value === 'collections' || value === 'materials';
}

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'library'; filter?: MaterialMembershipFilter; view?: LibraryViewMode }
  | { kind: 'explore'; initialFilter?: 'all' | 'official' | 'community' }
  | { kind: 'available' }
  | { kind: 'analytics' }
  | { kind: 'import' }
  | { kind: 'workspace'; workspace: 'material'; materialId: string; activeTab: 'read' | 'write' | 'quiz' | 'flashcards' | 'manage' }
  | { kind: 'quiz-canvas'; materialId: string; quizId?: string }
  | { kind: 'quiz-session'; quizId: string; materialIds: string[]; quizIds?: string[]; returnTo: AppRoute }
  | { kind: 'share'; shareId: string }
  | { kind: 'collection'; collectionId: string };

/**
 * Serialize an AppRoute to a URL path string.
 */
export function routeToUrl(route: AppRoute): string {
  switch (route.kind) {
    case 'home':
      return '/';
    case 'library': {
      const params = new URLSearchParams();
      if (route.filter && route.filter !== 'all') params.set('filter', route.filter);
      if (route.view && route.view !== 'overview') params.set('view', route.view);
      const query = params.toString();
      return query ? `/library?${query}` : '/library';
    }
    case 'explore':
      return '/explore';
    case 'available':
      return '/explore';
    case 'analytics':
      return '/analytics';
    case 'import':
      return '/import';
    case 'share':
      return `/share/${route.shareId}`;
    case 'collection':
      return `/collections/${route.collectionId}`;
    case 'workspace':
      return `/materials/${route.materialId}?tab=${route.activeTab}`;
    case 'quiz-canvas':
      return `/materials/${route.materialId}/builder${route.quizId ? `/${route.quizId}` : ''}`;
    case 'quiz-session':
      return `/quiz/${route.quizId}`;
  }
}

/**
 * Attempt to parse a URL path into an AppRoute.
 * Returns null if the path does not match a known route pattern.
 */
export function urlToRoute(path: string, search: string): AppRoute | null {
  const url = new URL(path + search, window.location.origin);

  // /share/:shareId or /s/:code — shared study package landing
  const shareMatch = url.pathname.match(/^\/share\/([^/]+)$/);
  if (shareMatch) {
    return { kind: 'share', shareId: shareMatch[1] };
  }

  const shortShareMatch = url.pathname.match(/^\/s\/([^/]+)$/);
  if (shortShareMatch) {
    return { kind: 'share', shareId: shortShareMatch[1] };
  }

  // /materials/:materialId/builder[/:quizId] — dedicated quiz canvas route
  const builderMatch = url.pathname.match(/^\/materials\/([^/]+)\/builder(?:\/([^/]+))?$/);
  if (builderMatch) {
    return { kind: 'quiz-canvas', materialId: builderMatch[1], quizId: builderMatch[2] ?? undefined };
  }

  // /materials/:materialId
  const materialMatch = url.pathname.match(/^\/materials\/([^/]+)$/);
  if (materialMatch) {
    const tab = (url.searchParams.get('tab') as 'read' | 'write' | 'quiz' | 'flashcards' | 'manage') ?? 'read';
    return { kind: 'workspace', workspace: 'material', materialId: materialMatch[1], activeTab: tab };
  }

  // /collections/:collectionId
  const collectionMatch = url.pathname.match(/^\/collections\/([^/]+)$/);
  if (collectionMatch) {
    return { kind: 'collection', collectionId: collectionMatch[1] };
  }

  // /quiz/:quizId
  const quizMatch = url.pathname.match(/^\/quiz\/([^/]+)$/);
  if (quizMatch) {
    return { kind: 'quiz-session', quizId: quizMatch[1], materialIds: [], returnTo: { kind: 'library' } };
  }

  // /library — collections + materials, with an optional membership lens and view mode
  if (url.pathname === '/library') {
    const rawFilter = url.searchParams.get('filter');
    const rawView = url.searchParams.get('view');
    return {
      kind: 'library',
      filter: isMaterialMembershipFilter(rawFilter) ? rawFilter : undefined,
      view: isLibraryViewMode(rawView) ? rawView : undefined,
    };
  }

  // /explore
  if (url.pathname === '/explore') {
    return { kind: 'explore' };
  }

  // /available (legacy alias to explore)
  if (url.pathname === '/available') {
    return { kind: 'explore' };
  }

  // /analytics
  if (url.pathname === '/analytics') {
    return { kind: 'analytics' };
  }

  // /import
  if (url.pathname === '/import') {
    return { kind: 'import' };
  }

  // / (home)
  if (url.pathname === '/' || url.pathname === '') {
    return { kind: 'home' };
  }

  return null;
}
