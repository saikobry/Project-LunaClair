import type { AppRoute } from '../../../routing/routing';

/** One breadcrumb: a label plus the route it navigates to. */
export interface WorkspaceBreadcrumb {
  label: string;
  /** Destination for this crumb. Omitted on the last crumb (the current page). */
  target?: AppRoute;
}

/**
 * Breadcrumb path for the material workspace.
 *
 * Origin-aware: when the workspace was opened from a collection, that
 * collection is inserted between Library and the material, so the hierarchy
 * reads `Library / {collection} / {material}` and the collection crumb leads
 * back to the playlist. Without an origin — or when the origin collection no
 * longer resolves (deleted, or a stale `?from=` link) — it degrades to the
 * two-level `Library / {material}` path rather than showing a crumb it cannot
 * name.
 *
 * Pure: the caller owns data fetching and navigation.
 */
export function workspaceBreadcrumbs(
  materialTitle: string,
  origin: { id: string; title: string } | null,
): WorkspaceBreadcrumb[] {
  const crumbs: WorkspaceBreadcrumb[] = [
    { label: 'Library', target: { kind: 'library' } },
  ];

  if (origin) {
    crumbs.push({
      label: origin.title,
      target: { kind: 'collection', collectionId: origin.id },
    });
  }

  crumbs.push({ label: materialTitle });

  return crumbs;
}
