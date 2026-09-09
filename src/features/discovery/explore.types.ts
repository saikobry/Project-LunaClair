/**
 * Types for the Explore Discovery Hub.
 *
 * Explore surfaces exactly one content kind: published `.lcpack` study
 * package shares. Official/verified packages are just shares flagged
 * `isVerified` by the platform; there is no separate catalog item shape.
 */

export type ExploreSortOption = 'popular' | 'recent';

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
}
