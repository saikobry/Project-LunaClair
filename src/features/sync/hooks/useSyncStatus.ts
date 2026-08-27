import { useState, useEffect, useContext, useCallback } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { syncStatusStore, type SyncStatus } from '../../../application/sync/SyncStatusStore';

export interface UseSyncStatusResult {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  pendingCount: number;
  lastSyncedAt?: string;
  lastError?: string;
  conflictCount: number;
  triggerSync: () => Promise<void>;
}

/**
 * React hook subscribing to cloud sync status changes, pending mutation count,
 * diagnostic error messages, and unresolved conflict draft count.
 */
export function useSyncStatus(): UseSyncStatusResult {
  const context = useContext(ApplicationContext);
  const store = context?.useCases?.sync?.syncStatusStore ?? syncStatusStore;

  const [status, setStatus] = useState<SyncStatus>(() => store.getState());
  const [conflictCount, setConflictCount] = useState<number>(0);

  const getConflictDraftsUseCase =
    context?.useCases?.sync?.getConflictDrafts ??
    context?.useCases?.getConflictDraftsUseCase;

  const triggerSyncUseCase =
    context?.useCases?.sync?.triggerSync ??
    context?.useCases?.triggerSyncUseCase;

  const refreshConflictCount = useCallback(async () => {
    if (getConflictDraftsUseCase) {
      try {
        const drafts = await getConflictDraftsUseCase.execute();
        setConflictCount(drafts.length);
      } catch {
        // Tolerant to fetch failures during initialization
      }
    } else if (context?.conflictDraftRepository) {
      try {
        const count = await context.conflictDraftRepository.count();
        setConflictCount(count);
      } catch {
        // Tolerant
      }
    }
  }, [context, getConflictDraftsUseCase]);

  // Subscribe to store updates
  useEffect(() => {
    setStatus(store.getState());
    void refreshConflictCount();

    const unsubscribe = store.subscribe((nextStatus: SyncStatus) => {
      setStatus(nextStatus);
      void refreshConflictCount();
    });

    return unsubscribe;
  }, [store, refreshConflictCount]);

  const triggerSync = useCallback(async () => {
    if (triggerSyncUseCase) {
      await triggerSyncUseCase.execute();
    } else if (context?.useCases?.sync?.syncEngine && context?.credentialsProvider) {
      const creds = await context.credentialsProvider.getCredentials();
      if (creds) {
        await context.useCases.sync.syncEngine.sync(creds);
      }
    }
    await refreshConflictCount();
  }, [context, triggerSyncUseCase, refreshConflictCount]);

  return {
    state: status.state,
    pendingCount: status.pendingCount,
    lastSyncedAt: status.lastSyncedAt,
    lastError: status.lastError,
    conflictCount,
    triggerSync,
  };
}
