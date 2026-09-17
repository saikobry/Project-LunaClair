/**
 * Types for the Explore Discovery Hub.
 *
 * Explore surfaces exactly one content kind: published `.lcpack` study
 * package shares. Official/verified packages are just shares flagged
 * `isVerified` by the platform; there is no separate catalog item shape.
 */

export const EXPLORE_SORT_OPTIONS: readonly ExploreSortOption[] = ['popular', 'recent'];

export type ExploreSortOption = 'popular' | 'recent';

/**
 * Narrows an untrusted value (URL param, select value) to a sort option.
 * Lives with the type so the route parser and the screen share one validator.
 */
export function isExploreSortOption(value: unknown): value is ExploreSortOption {
  return value === 'popular' || value === 'recent';
}

/**
 * Shares fetched per request. The Worker caps `limit` at 50, and this hub has
 * no cursor pagination yet (see docs/architecture/plans/explore-hub-overhaul-plan.md
 * §3.2), so the hub shows the top page for the active sort. Kept as an explicit
 * constant so the ceiling is a known constraint rather than an accidental
 * default — raise it here, and add a cursor flow, when the catalog outgrows one page.
 */
export const EXPLORE_PAGE_LIMIT = 50;

export interface ExploreContentItem {
  id: string;
  title: string;
  description?: string;
  author?: string;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
  /** Platform-verified course package (e.g. seeded official curriculum). */
  isVerified: boolean;
  /** Exact clone identity: the share's package already lives in the local library. */
  isInLibrary: boolean;
  /**
   * The local material this share was cloned into, when `isInLibrary` is set.
   * Both fields are derived from the same `originShareId` lookup, so they can
   * never disagree; this is what the card's "Open in library" next step needs,
   * since the local material id is not derivable from the share id.
   */
  libraryMaterialId?: string;
}
