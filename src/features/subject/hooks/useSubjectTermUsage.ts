import { useQuery } from '@tanstack/react-query';
import type { Term } from '../../../domain/library';
import { libraryQueryKeys } from '../../library/queries/libraryQueryKeys';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../shared/utils/contextGuard';

/**
 * Query hook resolving how many subjects each term is shared across.
 *
 * Returns a `Map<termId, subjectCount>` where `subjectCount` includes the
 * current subject itself, so a value of `1` means the term is used only
 * in this subject.
 */
export function useSubjectTermUsage(subjectId: string, terms: Term[]) {
  const context = useContextOrThrow(ApplicationContext, 'useSubjectTermUsage');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...libraryQueryKeys.root, 'terms', subjectId, 'subjectUsage'],
    queryFn: async () => {
      const results = await Promise.all(
        terms.map(async (term) => {
          const subjectIds = await context.subjectTermRepository.getSubjectIdsByTerm(term.id);
          return [term.id, subjectIds.length] as const;
        }),
      );
      return new Map(results);
    },
    enabled: terms.length > 0,
  });

  return { subjectCounts: data ?? new Map<string, number>(), isLoading, isError, error };
}
