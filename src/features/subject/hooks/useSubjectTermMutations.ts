import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Term } from '../../../domain/library';
import { libraryQueryKeys } from '../../library/queries/libraryQueryKeys';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { useToast } from '../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../shared/utils/contextGuard';

/** Query key for the terms assigned to a specific subject. */
function subjectTermsKey(subjectId: string) {
  return [...libraryQueryKeys.root, 'terms', subjectId] as const;
}

/**
 * Attaches an existing global term to the subject.
 * On success: shows a confirmation toast and invalidates the subject-scoped terms query.
 */
export function useAddSubjectTerm(subjectId: string) {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useAddSubjectTerm');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (termId: string) =>
      context.subjectTermRepository.addTerm(subjectId, termId),

    onSuccess: () => {
      showToast('Term added to subject', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: subjectTermsKey(subjectId) });
    },
  });
}

/**
 * Unlinks a term from the subject (the global term remains intact).
 * On success: shows a confirmation toast and invalidates the subject-scoped terms query.
 */
export function useRemoveSubjectTerm(subjectId: string) {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useRemoveSubjectTerm');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (termId: string) =>
      context.subjectTermRepository.removeTerm(subjectId, termId),

    onSuccess: () => {
      showToast('Term removed from subject', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: subjectTermsKey(subjectId) });
    },
  });
}

/**
 * Reorders the terms assigned to a subject with optimistic UI updates.
 *
 * - `onMutate`: snapshots the cached terms and reorders them in the cache
 *   immediately so the UI does not snap back while the write is in flight.
 * - `onSuccess`: retains the optimistic cache (no immediate refetch).
 * - `onError`: rolls back to the previous cached order.
 * - `onSettled`: invalidates the query to reconcile with persisted state.
 */
export function useReorderSubjectTerms(subjectId: string) {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useReorderSubjectTerms');
  const { showToast } = useToast();

  const key = subjectTermsKey(subjectId);

  return useMutation({
    mutationFn: (orderedTermIds: string[]) =>
      context.subjectTermRepository.reorderTerms(subjectId, orderedTermIds),

    onMutate: async (orderedTermIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previousTerms = queryClient.getQueryData<Term[]>(key);

      if (previousTerms) {
        const orderMap = new Map(orderedTermIds.map((id, index) => [id, index]));
        const reordered = previousTerms.toSorted(
          (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999),
        );
        queryClient.setQueryData(key, reordered);
      }

      return { previousTerms };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previousTerms) {
        queryClient.setQueryData(key, ctx.previousTerms);
      }
      showToast('Failed to save term order', { intent: 'error' });
    },

    onSuccess: () => {
      // Retain the optimistic cache — no refetch needed since the persisted
      // order matches the optimistically applied order.
      showToast('Term order saved', { intent: 'success' });
    },
  });
}

/**
 * Creates a new global term and assigns it to the subject in a single
 * atomic application-service transaction (TermService).
 * On success: shows a confirmation toast and invalidates the subject-scoped
 * terms query and the global terms catalog query.
 */
export function useCreateAndAssignTerm(subjectId: string) {
  const queryClient = useQueryClient();
  const context = useContextOrThrow(ApplicationContext, 'useCreateAndAssignTerm');
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (title: string) =>
      context.termService.createAndAssignTerm(subjectId, title),

    onSuccess: () => {
      showToast('Term created and added to subject', { intent: 'success' });
      queryClient.invalidateQueries({ queryKey: subjectTermsKey(subjectId) });
      queryClient.invalidateQueries({ queryKey: [...libraryQueryKeys.root, 'terms'] });
    },
  });
}
