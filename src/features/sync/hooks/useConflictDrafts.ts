import { useState, useEffect, useContext, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { QueryClientContext } from '@tanstack/react-query';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type { ConflictDraft } from '../../../domain/sync/models/sync.types';
import type { ResolveConflictDraftInput } from '../../../application/use-cases/sync/ResolveConflictDraftUseCase';
import { readerQueryKeys } from '../../reader/queries/readerQueryKeys';
import { materialQueryKeys } from '../../materials/queries/materialQueryKeys';

export interface UseConflictDraftsResult {
  drafts: ConflictDraft[];
  isLoading: boolean;
  error: string | null;
  resolveDraft: (input: ResolveConflictDraftInput) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook for querying and resolving divergent conflict drafts.
 * Uses Dexie `useLiveQuery` when `db` is available, falling back to use cases when uninitialized.
 */
export function useConflictDrafts(documentId?: string): UseConflictDraftsResult {
  const context = useContext(ApplicationContext);
  const queryClient = useContext(QueryClientContext);
  const db = context?.infrastructure?.db;
  const hasDb = Boolean(db?.conflictDrafts);

  const liveDrafts = useLiveQuery(
    async () => {
      if (!hasDb || !db || typeof db.isOpen !== 'function' || !db.isOpen() || !db.conflictDrafts) {
        return undefined;
      }
      try {
        return documentId
          ? await db.conflictDrafts.where('documentId').equals(documentId).toArray()
          : await db.conflictDrafts.toArray();
      } catch {
        return undefined;
      }
    },
    [db, documentId, hasDb]
  );

  const [fallbackDrafts, setFallbackDrafts] = useState<ConflictDraft[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState<boolean>(!hasDb);
  const [error, setError] = useState<string | null>(null);

  const getConflictDraftsUseCase = context?.useCases?.sync?.getConflictDrafts;
  const resolveConflictDraftUseCase = context?.useCases?.sync?.resolveConflictDraft;

  const fetchFallbackDrafts = useCallback(async () => {
    if (!getConflictDraftsUseCase) return [];
    return await getConflictDraftsUseCase.execute(documentId);
  }, [documentId, getConflictDraftsUseCase]);

  const refetch = useCallback(async () => {
    if (!hasDb) {
      try {
        setFallbackLoading(true);
        const result = await fetchFallbackDrafts();
        setFallbackDrafts(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setFallbackLoading(false);
      }
    }
  }, [hasDb, fetchFallbackDrafts]);

  useEffect(() => {
    if (hasDb) return;

    let cancelled = false;
    async function load() {
      try {
        setFallbackLoading(true);
        const result = await fetchFallbackDrafts();
        if (!cancelled) setFallbackDrafts(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setFallbackLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hasDb, fetchFallbackDrafts]);

  const resolveDraft = useCallback(
    async (input: ResolveConflictDraftInput) => {
      if (resolveConflictDraftUseCase) {
        await resolveConflictDraftUseCase.execute(input);
      }
      if (queryClient) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: readerQueryKeys.all }),
          queryClient.invalidateQueries({ queryKey: materialQueryKeys.all }),
        ]);
      }
      if (!hasDb) {
        await refetch();
      }
    },
    [resolveConflictDraftUseCase, queryClient, hasDb, refetch]
  );

  const drafts = hasDb && liveDrafts !== undefined ? liveDrafts : fallbackDrafts;
  const isLoading = hasDb ? liveDrafts === undefined : fallbackLoading;

  return {
    drafts,
    isLoading,
    error,
    resolveDraft,
    refetch,
  };
}
