import { useState, useEffect, useContext, useCallback } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type { ConflictDraft } from '../../../domain/sync/sync.types';
import type { ResolveConflictDraftInput } from '../../../application/use-cases/sync/ResolveConflictDraftUseCase';

export interface UseConflictDraftsResult {
  drafts: ConflictDraft[];
  isLoading: boolean;
  error: string | null;
  resolveDraft: (input: ResolveConflictDraftInput) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook for querying and resolving divergent conflict drafts.
 */
export function useConflictDrafts(documentId?: string): UseConflictDraftsResult {
  const context = useContext(ApplicationContext);
  const [drafts, setDrafts] = useState<ConflictDraft[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getConflictDraftsUseCase =
    context?.useCases?.sync?.getConflictDrafts ??
    context?.useCases?.getConflictDraftsUseCase;

  const resolveConflictDraftUseCase =
    context?.useCases?.sync?.resolveConflictDraft ??
    context?.useCases?.resolveConflictDraftUseCase;

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (getConflictDraftsUseCase) {
        const result = await getConflictDraftsUseCase.execute(documentId);
        setDrafts(result);
      } else if (context?.conflictDraftRepository) {
        const result = documentId
          ? await context.conflictDraftRepository.getByDocumentId(documentId)
          : await context.conflictDraftRepository.getAll();
        setDrafts(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [context, documentId, getConflictDraftsUseCase]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const resolveDraft = useCallback(
    async (input: ResolveConflictDraftInput) => {
      if (resolveConflictDraftUseCase) {
        await resolveConflictDraftUseCase.execute(input);
      } else if (context?.conflictDraftRepository) {
        await context.conflictDraftRepository.removeConflictDraft(input.draftId);
      }
      await refetch();
    },
    [context, resolveConflictDraftUseCase, refetch]
  );

  return {
    drafts,
    isLoading,
    error,
    resolveDraft,
    refetch,
  };
}
