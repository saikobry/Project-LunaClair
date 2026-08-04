import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { useLibrary } from '../../../materials/hooks/queries/useLibrary';
import { useTerms } from './useTerms';
import { useContextOrThrow } from '../../../../../shared/utils/contextGuard';

export interface TermUsageCounts {
  /** Number of subjects the global term is assigned to. */
  subjectCount: number;
  /** Number of study materials referencing the term. */
  materialCount: number;
}

/**
 * Query hook resolving catalog-wide usage counts for every global term:
 * how many subjects each term is assigned to and how many materials
 * reference it. Returns a `Map<termId, TermUsageCounts>`.
 *
 * Subject counts come from a dedicated query keyed under
 * `['subject', 'terms', ...]` (invalidated by term CRUD), while material
 * counts derive from the shared `useLibrary` query (invalidated by
 * material CRUD) — so both badge numbers stay fresh.
 */
export function useTermUsageCounts() {
  const context = useContextOrThrow(ApplicationContext, 'useTermUsageCounts');
  const { terms } = useTerms();
  const { materials } = useLibrary();

  const { data: subjectCounts, isLoading } = useQuery({
    queryKey: catalogQueryKeys.termUsageCounts(),
    queryFn: async () => {
      const entries = await Promise.all(
        terms.map(async (term) => {
          const subjectIds = await context.subjectTermRepository.getSubjectIdsByTerm(term.id);
          return [term.id, subjectIds.length] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: terms.length > 0,
  });

  const usageCounts = useMemo(() => {
    const materialCountByTerm = new Map<string, number>();
    for (const material of materials) {
      if (!material.termId) continue;
      materialCountByTerm.set(
        material.termId,
        (materialCountByTerm.get(material.termId) ?? 0) + 1,
      );
    }

    const counts = new Map<string, TermUsageCounts>();
    for (const term of terms) {
      counts.set(term.id, {
        subjectCount: subjectCounts?.get(term.id) ?? 0,
        materialCount: materialCountByTerm.get(term.id) ?? 0,
      });
    }
    return counts;
  }, [terms, materials, subjectCounts]);

  return { usageCounts, isLoading, isError: false, error: null };
}
