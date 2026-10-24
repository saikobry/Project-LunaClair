import { useState, useEffect, useContext, useCallback, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { syncStatusStore, type SyncStatusState } from '../../../application/sync/SyncStatusStore';
import type { AuthStatus } from '../../../domain/auth/models/auth.types';
import { ANONYMOUS_OWNER_SUB } from '../../../domain/vault/models/vault.types';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';

export interface UseSyncStatusResult {
  state: SyncStatusState;
  status: SyncStatusState;
  pendingCount: number;
  lastSyncedAt?: string;
  lastError?: string;
  conflictCount: number;
  triggerSync: () => Promise<void>;
  reconnectAuth?: () => Promise<void>;
  pauseSync: () => Promise<void>;
  resumeSync: () => Promise<void>;
  isPaused: boolean;
  authStatus: AuthStatus;
  isAuthenticated: boolean;
  activeOwnerSub?: string;
  libraryLabel?: string;
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
  const syncEngine = context?.useCases?.sync?.syncEngine;
  const session = !isUnauthenticated && auth?.getSession ? auth.getSession() : null;
  const expectedSub = (context?.infrastructure as any)?.expectedSub;
  const persistedSub =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.vault.activeOwnerSub)
      : null;
  const activeOwnerSub = expectedSub ?? persistedSub ?? session?.user?.sub ?? ANONYMOUS_OWNER_SUB;

  const isPaused = Boolean(syncEngine?.isPaused(activeOwnerSub));

  const pauseSync = useCallback(async () => {
    if (syncEngine) {
      syncEngine.pause(activeOwnerSub);
    } else {
      store.setState({ state: 'paused' });
    }
  }, [syncEngine, activeOwnerSub, store]);

  const resumeSync = useCallback(async () => {
    const credentials = context?.infrastructure?.providers?.credentials
      ? await context.infrastructure.providers.credentials.getCredentials()
      : null;

    if (credentials && credentials.userId !== activeOwnerSub) {
      return;
    }

    if (syncEngine) {
      await syncEngine.resume(credentials, activeOwnerSub);
    } else {
      store.setState({ state: 'idle' });
      await triggerSync();
    }
  }, [syncEngine, context, activeOwnerSub, store, triggerSync]);

  const isStandby = !isPaused && (isUnauthenticated || authStatus === 'standby' || status.state === 'standby');
  const effectiveState: SyncStatusState = isPaused ? 'paused' : (isStandby ? 'standby' : status.state);
  const effectivePendingCount = isStandby ? 0 : status.pendingCount;
  const effectiveLastError = isUnauthenticated ? undefined : status.lastError;
  const conflictCount = liveConflictCount !== undefined ? liveConflictCount : fallbackConflictCount;

  const activeSession = session;

  const isLocalOnly =
    !activeOwnerSub ||
    activeOwnerSub === ANONYMOUS_OWNER_SUB ||
    activeOwnerSub === 'anonymous';

  const isConnectedOwner = Boolean(
    activeSession?.user?.sub &&
    activeSession.user.sub === activeOwnerSub
  );

  const libraryLabel = isLocalOnly
    ? 'Local-only Library'
    : isConnectedOwner
      ? `Account Library (${activeSession?.user?.email ?? activeSession?.user?.name ?? activeOwnerSub})`
      : `Account Library (${activeOwnerSub.length > 8 ? `...${activeOwnerSub.slice(-4)}` : activeOwnerSub})`;

  return {
    state: effectiveState,
    status: effectiveState,
    pendingCount: effectivePendingCount,
    lastSyncedAt: status.lastSyncedAt,
    lastError: effectiveLastError,
    conflictCount,
    triggerSync,
    reconnectAuth,
    pauseSync,
    resumeSync,
    isPaused,
    authStatus,
    isAuthenticated: !isUnauthenticated && authStatus === 'authenticated',
    activeOwnerSub,
    libraryLabel,
  };
}
