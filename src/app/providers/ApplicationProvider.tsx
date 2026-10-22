import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApplicationContext, type ApplicationContextValue } from './ApplicationContext';
import { createApplication } from '../bootstrap/createApplication';
import { ANALYTICS_QUERY_KEY } from '../bootstrap/analyticsInvalidation';
import type { SyncAppliedEvent, SyncEventSink } from '../../application/sync/SyncEventSink';
import {
  SYNC_APPLIED_CHANNEL_NAME,
  SYNC_ENTITY_QUERY_ROOTS,
  createDebouncedSyncInvalidator,
  type DebouncedSyncInvalidator,
} from '../bootstrap/syncInvalidation';
import { vaultRegistry } from '../../infrastructure/database/registry/VaultRegistry';
import { DatabaseInitializer } from '../../infrastructure/database/schema/DatabaseInitializer';
import {
  openVaultDatabase,
  setActiveVaultDatabase,
  type LunaClairDatabase,
} from '../../infrastructure/database/schema/LunaClairDatabase';
import {
  DatabaseReloadRequiredError,
  type DatabaseReloadReason,
} from '../../infrastructure/database/schema/databaseLifecycle';
import DatabaseReloadScreen from '../layouts/DatabaseReloadScreen';
import { reloadWithFreshServiceWorker } from '../serviceWorkerUpdate';

export { SYNC_APPLIED_CHANNEL_NAME, SYNC_ENTITY_QUERY_ROOTS };

interface ApplicationProviderProps {
  children: ReactNode;
}

interface ApplicationContainerState {
  value: ApplicationContextValue;
  invalidator: DebouncedSyncInvalidator;
}

function broadcastSyncApplied(event: SyncAppliedEvent): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(SYNC_APPLIED_CHANNEL_NAME);
    channel.postMessage({
      appliedCount: event.appliedCount,
      touchedEntities: event.touchedEntities,
    });
    channel.close();
  } catch {
    // best-effort broadcast
  }
}

function buildContainerState(
  queryClient: QueryClient,
  database?: LunaClairDatabase,
): ApplicationContainerState {
  const invalidator = createDebouncedSyncInvalidator((queryKey) => {
    void queryClient.invalidateQueries({ queryKey });
  }, 150);

  const syncEventSink: SyncEventSink = {
    onApplied: (event: SyncAppliedEvent) => {
      invalidator.schedule(event.touchedEntities);
      broadcastSyncApplied(event);
    },
  };

  const value = createApplication(
    () => {
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY });
    },
    database,
    syncEventSink,
  );

  return { value, invalidator };
}

/**
 * Provides all domain repositories, infrastructure services, and application
 * use cases to feature hooks via React context. Instances are stable singletons
 * that never recreate across re-renders.
 *
 * This is also where the composition root's cache hooks (analytics pool invalidation
 * and reactive sync invalidation) are bound to the real `QueryClient`.
 * When sync pulls remote changes, `SyncEventSink` invalidates touched entity queries
 * outside Dexie transactions and broadcasts to sibling tabs via BroadcastChannel.
 *
 * Automatically transitions active vault and resets query caches upon user identity switch.
 */
type TransitionStatus =
  | { state: 'idle' }
  | { state: 'transitioning'; targetSub: string | null }
  | {
      state: 'error';
      targetSub: string | null;
      error: unknown;
      reloadReason?: DatabaseReloadReason;
      retry: () => void;
    };

export function ApplicationProvider({ children }: ApplicationProviderProps) {
  const queryClient = useQueryClient();

  const [containerState, setContainerState] = useState<ApplicationContainerState>(() =>
    buildContainerState(queryClient),
  );
  const [transitionStatus, setTransitionStatus] = useState<TransitionStatus>({ state: 'idle' });

  const { value, invalidator } = containerState;

  const containerStateRef = useRef(containerState);
  const transitionStatusRef = useRef(transitionStatus);

  useEffect(() => {
    containerStateRef.current = containerState;
    transitionStatusRef.current = transitionStatus;
  });

  // Track current user sub (null if unauthenticated)
  const initialSub = value.infrastructure.providers.auth.getSession()?.user.sub ?? null;
  const currentSubRef = useRef<string | null>(initialSub);
  const targetSubRef = useRef<string | null>(initialSub);
  const switchSeqRef = useRef<number>(0);

  const isMountedRef = useRef(false);

  // Dispose active application graph upon real unmount (protecting against StrictMode effect replay)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      queueMicrotask(() => {
        if (!isMountedRef.current) {
          containerStateRef.current.value.dispose?.();
          containerStateRef.current.invalidator.cancel();
        }
      });
    };
  }, []);

  // Subscribe to reload events on active database
  useEffect(() => {
    const db = value.infrastructure.db;
    let active = true;
    const unsubscribe = db.onReloadRequired((reason) => {
      if (active) {
        setTransitionStatus({
          state: 'error',
          targetSub: currentSubRef.current,
          error: new DatabaseReloadRequiredError(reason, db.name),
          reloadReason: reason,
          retry: () => {
            void reloadWithFreshServiceWorker();
          },
        });
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [value.infrastructure.db]);

  useEffect(() => {
    const auth = value.infrastructure.providers.auth;
    let cancelled = false;

    const executeTransition = async (targetSub: string | null, transitionSeq: number) => {
      let targetUnsubscribe: (() => void) | undefined;
      try {
        // 1. Resolve active vault for new identity
        const activeVault = await vaultRegistry.getActiveVault(targetSub ?? undefined);
        if (cancelled || transitionSeq !== switchSeqRef.current) return;

        // 2. Open and initialize database
        const database = openVaultDatabase(activeVault.physicalDbName);
        targetUnsubscribe = database.onReloadRequired((reason) => {
          if (!cancelled && transitionSeq === switchSeqRef.current) {
            setTransitionStatus({
              state: 'error',
              targetSub,
              error: new DatabaseReloadRequiredError(reason, database.name),
              reloadReason: reason,
              retry: () => {
                void reloadWithFreshServiceWorker();
              },
            });
          }
        });

        await DatabaseInitializer.initialize(database);
        if (cancelled || transitionSeq !== switchSeqRef.current) {
          targetUnsubscribe?.();
          return;
        }
        targetUnsubscribe?.();
        setActiveVaultDatabase(database);

        // 3. Clear query cache so User A's data doesn't leak to User B
        queryClient.clear();

        // 4. Update currentSubRef.current ONLY upon successful transition!
        currentSubRef.current = targetSub;

        // 5. Build new container state bound to the new database
        setContainerState(buildContainerState(queryClient, database));
        setTransitionStatus({ state: 'idle' });
      } catch (error) {
        targetUnsubscribe?.();
        if (cancelled || transitionSeq !== switchSeqRef.current) return;
        console.error('Failed to transition vault on auth change', error);
        const reloadReason = error instanceof DatabaseReloadRequiredError ? error.reason : undefined;
        setTransitionStatus({
          state: 'error',
          targetSub,
          error,
          reloadReason,
          retry: () => {
            const retrySeq = ++switchSeqRef.current;
            setTransitionStatus({ state: 'transitioning', targetSub });
            void executeTransition(targetSub, retrySeq);
          },
        });
      }
    };

    const unsubscribe = auth.subscribe((session) => {
      const newSub = session?.user.sub ?? null;
      // When session update is a same-account token refresh (session?.user.sub unchanged),
      // DO NOT re-create the container state or clear cache!
      if (newSub === targetSubRef.current && transitionStatusRef.current.state === 'idle') {
        return;
      }
      targetSubRef.current = newSub;
      const seq = ++switchSeqRef.current;

      // Retire previous runtime immediately at identity boundary
      containerStateRef.current.value.dispose?.();
      containerStateRef.current.invalidator.cancel();

      setTransitionStatus({ state: 'transitioning', targetSub: newSub });
      void executeTransition(newSub, seq);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [value.infrastructure.providers.auth, queryClient]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(SYNC_APPLIED_CHANNEL_NAME);

    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as Partial<SyncAppliedEvent> | undefined;
      if (data?.touchedEntities && Array.isArray(data.touchedEntities)) {
        invalidator.schedule(data.touchedEntities);
      }
    };

    return () => {
      channel.close();
      invalidator.cancel();
    };
  }, [invalidator]);

  const isTransitioning = transitionStatus.state === 'transitioning';
  const isError = transitionStatus.state === 'error';

  return (
    <ApplicationContext.Provider key={value.infrastructure.db.name} value={value}>
      {isTransitioning && (
        <div
          data-testid="vault-transition-gate"
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            padding: '2rem',
          }}
        >
          <p>Switching user vault...</p>
        </div>
      )}
      {isError && (
        transitionStatus.reloadReason ? (
          <DatabaseReloadScreen
            reason={transitionStatus.reloadReason}
            onReload={transitionStatus.retry}
          />
        ) : (
          <div
            data-testid="vault-transition-error"
            role="alert"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              padding: '2rem',
              gap: '1rem',
            }}
          >
            <p>
              Failed to switch user vault:{' '}
              {transitionStatus.error instanceof Error
                ? transitionStatus.error.message
                : String(transitionStatus.error)}
            </p>
            <button
              type="button"
              onClick={transitionStatus.retry}
              style={{
                padding: '0.5rem 1rem',
                cursor: 'pointer',
              }}
            >
              Retry vault switch
            </button>
          </div>
        )
      )}
      <div
        style={{ display: isTransitioning || isError ? 'none' : undefined }}
        inert={isTransitioning || isError ? true : undefined}
        aria-hidden={isTransitioning || isError ? 'true' : undefined}
      >
        <React.Fragment key={value.infrastructure.db.name}>
          {children}
        </React.Fragment>
      </div>
    </ApplicationContext.Provider>
  );
}
