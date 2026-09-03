/**
 * Types and filter contracts for the Explore Discovery Hub (Milestone 11E).
 */

export type ExploreSourceFilter = 'all' | 'official' | 'community';
export type ExploreSortOption = 'popular' | 'recent';

export type ExploreContentItem =
  | {
      source: 'official';
      id: string;
      title: string;
      description?: string;
      subjectId?: string;
      subjectName: string;
      termId?: string;
      termName: string;
      isInLibrary: boolean;
    }
  | {
      source: 'community';
      id: string;
      title: string;
      description?: string;
      author?: string;
      viewCount: number;
      downloadCount: number;
      createdAt: string;
      isInLibrary: boolean;
    };
