import { useState, useEffect, useContext, useCallback, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { syncStatusStore } from '../../../application/sync/SyncStatusStore';
import type { AuthStatus } from '../../../domain/auth/models/auth.types';

export interface UseSyncStatusResult {
  state: 'idle' | 'syncing' | 'offline' | 'error' | 'standby';
  status: 'idle' | 'syncing' | 'offline' | 'error' | 'standby';
  pendingCount: number;
  lastSyncedAt?: string;
  lastError?: string;
  conflictCount: number;
  triggerSync: () => Promise<void>;
  reconnectAuth?: () => Promise<void>;
  authStatus: AuthStatus;
  isAuthenticated: boolean;
}

/**
 * React hook subscribing to cloud sync status changes, pending mutation count,
 * diagnostic error messages, and unresolved conflict draft count.
 */
export function useSyncStatus(): UseSyncStatusResult {
  const context = useContext(ApplicationContext);
  const store = context?.useCases?.sync?.syncStatusStore ?? syncStatusStore;
  const auth = context?.infrastructure?.providers?.auth;
  const db = context?.infrastructure?.db;

  const liveConflictCount = useLiveQuery(
    async () => {
      if (!db || typeof db.isOpen !== 'function' || !db.isOpen() || !db.conflictDrafts) {
        return undefined;
      }
      try {
        return await db.conflictDrafts.count();
      } catch {
        return undefined;
      }
    },
    [db]
  );

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
  const [fallbackConflictCount, setFallbackConflictCount] = useState<number>(0);

  const getConflictDraftsUseCase = context?.useCases?.sync?.getConflictDrafts;

  const loadConflicts = useCallback(async () => {
    if (getConflictDraftsUseCase) {
      try {
        const drafts = await getConflictDraftsUseCase.execute();
        setFallbackConflictCount(drafts.length);
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
          if (!cancelled) setFallbackConflictCount(drafts.length);
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
    if (authStatus === 'unauthenticated' && auth) {
      await auth.login();
      return;
    }
    const useCase = context?.useCases?.sync?.triggerSync;
    if (useCase) {
      await useCase.execute();
    }
    await loadConflicts();
  }, [authStatus, auth, context, loadConflicts]);

  const reconnectAuth = useCallback(async () => {
    if (auth) {
      await auth.login();
    }
  }, [auth]);

  const isUnauthenticated = authStatus === 'unauthenticated';
  const isStandby = isUnauthenticated || authStatus === 'standby' || status.state === 'standby';
  const effectiveState = isStandby ? 'standby' : status.state;
  const effectivePendingCount = isStandby ? 0 : status.pendingCount;
  const effectiveLastError = isUnauthenticated ? undefined : status.lastError;
  const conflictCount = liveConflictCount !== undefined ? liveConflictCount : fallbackConflictCount;

  return {
    state: effectiveState,
    status: effectiveState,
    pendingCount: effectivePendingCount,
    lastSyncedAt: status.lastSyncedAt,
    lastError: effectiveLastError,
    conflictCount,
    triggerSync,
    reconnectAuth,
    authStatus,
    isAuthenticated: !isUnauthenticated && authStatus === 'authenticated',
  };
}
