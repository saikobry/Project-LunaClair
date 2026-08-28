/**
 * AppShell routing — the `AppRoute` union and its URL serialization.
 *
 * Kept separate from the shell component so `AppShell` stays focused on
 * layout, state, and Focus Mode motion. Feature components that need the
 * `AppRoute` type import it (type-only) via the `AppShell` re-export.
 */
export type AppRoute =
  | { kind: 'library' }
  | { kind: 'explore'; initialFilter?: 'all' | 'official' | 'community' }
  | { kind: 'available' }
  | { kind: 'analytics' }
  | { kind: 'preview'; materialId: string }
  | { kind: 'import' }
  | { kind: 'terms' }
  | { kind: 'subject'; subjectId: string; activeTab: 'materials' | 'quiz' | 'terms' }
  | { kind: 'workspace'; workspace: 'material'; materialId: string; activeTab: 'read' | 'write' | 'quiz' | 'flashcards' | 'manage'; subjectId?: string }
  | { kind: 'quiz-canvas'; materialId: string; quizId?: string }
  | { kind: 'quiz-session'; quizId: string; materialIds: string[]; quizIds?: string[]; subjectId?: string; returnTo: AppRoute }
  | { kind: 'share'; shareId: string };

/**
 * Serialize an AppRoute to a URL path string.
 */
export function routeToUrl(route: AppRoute): string {
  switch (route.kind) {
    case 'library':
      return '/';
    case 'explore':
      return '/explore';
    case 'available':
      return '/explore';
    case 'analytics':
      return '/analytics';
    case 'import':
      return '/import';
    case 'preview':
      return `/available/${route.materialId}/preview`;
    case 'terms':
      return '/terms';
    case 'share':
      return `/share/${route.shareId}`;
    case 'subject':
      return `/subjects/${route.subjectId}?tab=${route.activeTab}`;
    case 'workspace':
      return `/materials/${route.materialId}?tab=${route.activeTab}${route.subjectId ? `&subject=${route.subjectId}` : ''}`;
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

  // /available/:materialId/preview — read-only preview of a not-yet-imported material
  const previewMatch = url.pathname.match(/^\/available\/([^/]+)\/preview$/);
  if (previewMatch) {
    return { kind: 'preview', materialId: previewMatch[1] };
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
    const subjectId = url.searchParams.get('subject') ?? undefined;
    return { kind: 'workspace', workspace: 'material', materialId: materialMatch[1], activeTab: tab, subjectId };
  }


  // /subjects/:subjectId
  const subjectMatch = url.pathname.match(/^\/subjects\/([^/]+)$/);
  if (subjectMatch) {
    const tab = (url.searchParams.get('tab') as 'materials' | 'quiz' | 'terms') ?? 'materials';
    return { kind: 'subject', subjectId: subjectMatch[1], activeTab: tab };
  }

  // /quiz/:quizId
  const quizMatch = url.pathname.match(/^\/quiz\/([^/]+)$/);
  if (quizMatch) {
    return { kind: 'quiz-session', quizId: quizMatch[1], materialIds: [], returnTo: { kind: 'library' } };
  }

  // /terms
  if (url.pathname === '/terms') {
    return { kind: 'terms' };
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

  // / (library)
  if (url.pathname === '/' || url.pathname === '') {
    return { kind: 'library' };
  }

  return null;
}
