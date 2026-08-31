import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useContextOrThrow } from '../../../../../shared/utils/contextGuard';

/**
 * Query hook for fetching all subjects, sorted by their `order` field.
 * Subjects without an explicit order sort to the end by title.
 */
export function useSubjects() {
  const context = useContextOrThrow(ApplicationContext, 'useSubjects');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: catalogQueryKeys.subjects(),
    queryFn: ({ signal }) => context.infrastructure.repositories.subject.getSubjects(signal),
  });

  const subjects = useMemo(
    () =>
      (data ?? []).toSorted((a, b) =>
        (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title),
      ),
    [data],
  );

  return { subjects, isLoading, isError, error };
}
