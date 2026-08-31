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

  const getConflictDraftsUseCase = context?.useCases?.sync?.getConflictDrafts;
  const resolveConflictDraftUseCase = context?.useCases?.sync?.resolveConflictDraft;

  const fetchDrafts = useCallback(async () => {
    if (getConflictDraftsUseCase) {
      return await getConflictDraftsUseCase.execute(documentId);
    }
    if (context?.repositories?.conflictDraft) {
      return documentId
        ? await context.repositories.conflictDraft.getByDocumentId(documentId)
        : await context.repositories.conflictDraft.getAll();
    }
    return [];
  }, [context, documentId, getConflictDraftsUseCase]);

  const refetch = useCallback(async () => {
    try {
      const result = await fetchDrafts();
      setDrafts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [fetchDrafts]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await fetchDrafts();
        if (!cancelled) setDrafts(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchDrafts]);

  const resolveDraft = useCallback(
    async (input: ResolveConflictDraftInput) => {
      if (resolveConflictDraftUseCase) {
        await resolveConflictDraftUseCase.execute(input);
      } else if (context?.repositories?.conflictDraft) {
        await context.repositories.conflictDraft.removeConflictDraft(input.draftId);
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
