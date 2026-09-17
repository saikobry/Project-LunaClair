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
import {
  isExploreSortOption,
  type ExploreSortOption,
} from '../../features/discovery/explore.types';

export type { MaterialMembershipFilter, ExploreSortOption };

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

/**
 * Parses a serialized route (`/explore?q=biology`) back into an `AppRoute`.
 * Returns null for anything that is not a known app route, so an untrusted
 * value can never navigate somewhere the router does not own.
 */
export function routeFromUrl(value: string): AppRoute | null {
  if (!value.startsWith('/')) return null;
  const [path, search = ''] = value.split('?');
  return urlToRoute(path, search ? `?${search}` : '');
}

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'library'; filter?: MaterialMembershipFilter; view?: LibraryViewMode }
  /**
   * Explore hub. `q` and `sort` are URL state, not component state, so a
   * filtered view can be linked, reloaded into, and restored by Back — the
   * same contract `/library` uses for `filter`/`view`.
   */
  | { kind: 'explore'; q?: string; sort?: ExploreSortOption }
  | { kind: 'analytics' }
  | { kind: 'import' }
  /**
   * Material workspace. `fromCollectionId` records the playlist the user
   * opened the material from, so the breadcrumb can render
   * `Library / {collection} / {material}` instead of losing the context on
   * click. It is URL state (`?from=`), so it survives reload and links, and
   * it is provenance — never a membership claim.
   */
  | {
      kind: 'workspace';
      workspace: 'material';
      materialId: string;
      activeTab: 'read' | 'write' | 'quiz' | 'flashcards' | 'manage';
      fromCollectionId?: string;
    }
  | { kind: 'quiz-canvas'; materialId: string; quizId?: string }
  | { kind: 'quiz-session'; quizId: string; materialIds: string[]; quizIds?: string[]; returnTo: AppRoute }
  /**
   * Shared study package landing. `from` is the **route** it was opened from,
   * not just a surface name, so leaving the package returns to that exact view
   * — the Explore hub's filters are URL state (`/explore?q=&sort=`) and would
   * otherwise be dropped by "back". It serializes to `?from=` (the origin's own
   * URL), so it survives reload and links, and an external deep link simply has
   * no origin → the Library default.
   */
  | { kind: 'share'; shareId: string; from?: AppRoute }
  | { kind: 'collection'; collectionId: string };

/**
 * Serialize an AppRoute to a URL path string.
 *
 * Query-param order is a convention, not a contract — parsing reads named
 * params and is order-agnostic. Keep it deterministic: always-present params
 * first, optional qualifiers after (e.g. `?tab=read&from=c-1`), so the
 * identifying param stays at a stable position for substring/regex matching.
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
    case 'explore': {
      // Defaults (`popular`, no query) are omitted so the canonical bare
      // `/explore` URL survives a round trip. A blank query is not a filter,
      // and the query is trimmed so the URL never carries %20 padding.
      const params = new URLSearchParams();
      const q = route.q?.trim();
      if (q) params.set('q', q);
      if (route.sort && route.sort !== 'popular') params.set('sort', route.sort);
      const query = params.toString();
      return query ? `/explore?${query}` : '/explore';
    }
    case 'analytics':
      return '/analytics';
    case 'import':
      return '/import';
    case 'share': {
      const params = new URLSearchParams();
      // `URLSearchParams` percent-encodes the nested origin URL for us.
      if (route.from) params.set('from', routeToUrl(route.from));
      const query = params.toString();
      return query ? `/share/${route.shareId}?${query}` : `/share/${route.shareId}`;
    }
    case 'collection':
      return `/collections/${route.collectionId}`;
    case 'workspace': {
      const params = new URLSearchParams();
      params.set('tab', route.activeTab);
      if (route.fromCollectionId) params.set('from', route.fromCollectionId);
      return `/materials/${route.materialId}?${params.toString()}`;
    }
    case 'quiz-canvas':
      return `/materials/${route.materialId}/builder${route.quizId ? `/${route.quizId}` : ''}`;
    case 'quiz-session':
      return `/quiz/${route.quizId}`;
  }
}

/**
 * Reads the share's `?from=` origin.
 *
 * Explore is the only surface in the app that opens a share, so anything else —
 * a malformed value, a retired origin, a crafted share-nested-in-share — is
 * ignored and the package keeps the Library default. Widen this (and the
 * screen's labels) when a second surface starts opening shares.
 */
function shareOriginFromParams(url: URL): AppRoute | undefined {
  const raw = url.searchParams.get('from');
  if (!raw) return undefined;
  const parsed = routeFromUrl(raw);
  return parsed?.kind === 'explore' ? parsed : undefined;
}

/**
 * Builds the Explore route from its query params, ignoring an empty query or
 * an unknown sort so a malformed link degrades to the default view.
 */
function exploreRouteFromParams(url: URL): AppRoute {
  const q = url.searchParams.get('q');
  const rawSort = url.searchParams.get('sort');

  return {
    kind: 'explore',
    q: q?.trim() ? q.trim() : undefined,
    sort: isExploreSortOption(rawSort) ? rawSort : undefined,
  };
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
    return { kind: 'share', shareId: shareMatch[1], from: shareOriginFromParams(url) };
  }

  const shortShareMatch = url.pathname.match(/^\/s\/([^/]+)$/);
  if (shortShareMatch) {
    return { kind: 'share', shareId: shortShareMatch[1], from: shareOriginFromParams(url) };
  }

  // /materials/:materialId/builder[/:quizId] — dedicated quiz canvas route
  const builderMatch = url.pathname.match(/^\/materials\/([^/]+)\/builder(?:\/([^/]+))?$/);
  if (builderMatch) {
    return { kind: 'quiz-canvas', materialId: builderMatch[1], quizId: builderMatch[2] ?? undefined };
  }

  // /materials/:materialId(?tab=&from=)
  const materialMatch = url.pathname.match(/^\/materials\/([^/]+)$/);
  if (materialMatch) {
    const tab = (url.searchParams.get('tab') as 'read' | 'write' | 'quiz' | 'flashcards' | 'manage') ?? 'read';
    const from = url.searchParams.get('from');
    return {
      kind: 'workspace',
      workspace: 'material',
      materialId: materialMatch[1],
      activeTab: tab,
      fromCollectionId: from || undefined,
    };
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

  // /explore(?q=&sort=)
  if (url.pathname === '/explore') {
    return exploreRouteFromParams(url);
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
