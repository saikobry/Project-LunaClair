import { useState, useEffect, useContext, useCallback, useSyncExternalStore } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { syncStatusStore } from '../../../application/sync/SyncStatusStore';

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

  const status = useSyncExternalStore(
    (notify) => store.subscribe(notify),
    () => store.getState(),
    () => store.getState(),
  );
  const [conflictCount, setConflictCount] = useState<number>(0);

  const getConflictDraftsUseCase = context?.useCases?.sync?.getConflictDrafts;

  const loadConflicts = useCallback(async () => {
    if (getConflictDraftsUseCase) {
      try {
        const drafts = await getConflictDraftsUseCase.execute();
        setConflictCount(drafts.length);
      } catch {
        // Tolerant to fetch failures during initialization
      }
    } else if (context?.infrastructure?.repositories?.conflictDraft) {
      try {
        const count = await context.infrastructure.repositories.conflictDraft.count();
        setConflictCount(count);
      } catch {
        // Tolerant
      }
    }
  }, [context, getConflictDraftsUseCase]);

  // Refresh conflict count on mount and whenever store updates
  useEffect(() => {
    let cancelled = false;
    async function update() {
      if (getConflictDraftsUseCase) {
        try {
          const drafts = await getConflictDraftsUseCase.execute();
          if (!cancelled) setConflictCount(drafts.length);
        } catch {
          // Tolerant
        }
      } else if (context?.infrastructure?.repositories?.conflictDraft) {
        try {
          const count = await context.infrastructure.repositories.conflictDraft.count();
          if (!cancelled) setConflictCount(count);
        } catch {
          // Tolerant
        }
      }
    }

    void update();
    const unsubscribe = store.subscribe(() => {
      void update();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [context, store, getConflictDraftsUseCase]);

  const triggerSync = useCallback(async () => {
    const useCase = context?.useCases?.sync?.triggerSync;
    if (useCase) {
      await useCase.execute();
    } else if (context?.useCases?.sync?.syncEngine && context?.infrastructure?.providers?.credentials) {
      const creds = await context.infrastructure.providers.credentials.getCredentials();
      if (creds) {
        await context.useCases.sync.syncEngine.sync(creds);
      }
    }
    await loadConflicts();
  }, [context, loadConflicts]);

  return {
    state: status.state,
    pendingCount: status.pendingCount,
    lastSyncedAt: status.lastSyncedAt,
    lastError: status.lastError,
    conflictCount,
    triggerSync,
  };
}
