import { useState, useEffect, useContext, useCallback, useSyncExternalStore } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { syncStatusStore } from '../../../application/sync/SyncStatusStore';
import type { AuthStatus } from '../../../domain/auth/models/auth.types';

export interface UseSyncStatusResult {
  state: 'idle' | 'syncing' | 'offline' | 'error' | 'standby';
  pendingCount: number;
  lastSyncedAt?: string;
  lastError?: string;
  conflictCount: number;
  triggerSync: () => Promise<void>;
  reconnectAuth?: () => Promise<void>;
}

/**
 * React hook subscribing to cloud sync status changes, pending mutation count,
 * diagnostic error messages, and unresolved conflict draft count.
 */
export function useSyncStatus(): UseSyncStatusResult {
  const context = useContext(ApplicationContext);
  const store = context?.useCases?.sync?.syncStatusStore ?? syncStatusStore;
  const auth = context?.infrastructure?.providers?.auth;

  const authStatus: AuthStatus = useSyncExternalStore(
    (notify) => auth?.subscribe(notify) ?? (() => {}),
    () => auth?.getStatus() ?? 'unauthenticated',
    () => auth?.getStatus() ?? 'unauthenticated',
  );

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
    }
  }, [getConflictDraftsUseCase]);

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
  }, [store, getConflictDraftsUseCase]);

  const triggerSync = useCallback(async () => {
    const useCase = context?.useCases?.sync?.triggerSync;
    if (useCase) {
      await useCase.execute();
    }
    await loadConflicts();
  }, [context, loadConflicts]);

  const reconnectAuth = useCallback(async () => {
    if (auth) {
      await auth.login();
    }
  }, [auth]);

  const effectiveState = (authStatus === 'standby' || status.state === 'standby') ? 'standby' : status.state;

  return {
    state: effectiveState,
    pendingCount: status.pendingCount,
    lastSyncedAt: status.lastSyncedAt,
    lastError: status.lastError,
    conflictCount,
    triggerSync,
    reconnectAuth,
  };
}
