import { useMemo } from 'react';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

export interface RecentMaterials {
  /** Most recently opened material — the continue-studying hero. */
  hero: (StudyMaterial & { lastOpenedAt: string }) | undefined;
  /** The next three, for the recent shelf. */
  recent: (StudyMaterial & { lastOpenedAt: string })[];
}

/**
 * Home recency model: most-recently-opened first. A material that has never
 * been opened has no recency and cannot seed a "continue studying" affordance.
 */
export function useRecentMaterials(materials: StudyMaterial[]): RecentMaterials {
  return useMemo(() => {
    const byRecency = materials
      .filter((m): m is StudyMaterial & { lastOpenedAt: string } => Boolean(m.lastOpenedAt))
      .toSorted(
        (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime(),
      );
    return { hero: byRecency[0], recent: byRecency.slice(1, 4) };
  }, [materials]);
}
