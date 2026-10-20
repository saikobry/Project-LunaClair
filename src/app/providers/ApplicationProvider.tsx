import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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

/**
 * Provides all domain repositories, infrastructure services, and application
 * use cases to feature hooks via React context. Instances are stable singletons
 * that never recreate across re-renders.
 *
 * This is also where the composition root's cache hooks (analytics pool invalidation
 * and reactive sync invalidation) are bound to the real `QueryClient`.
 * When sync pulls remote changes, `SyncEventSink` invalidates touched entity queries
 * outside Dexie transactions and broadcasts to sibling tabs via BroadcastChannel.
 */
export function ApplicationProvider({ children }: ApplicationProviderProps) {
  const queryClient = useQueryClient();

  const [containerState] = useState<ApplicationContainerState>(() => {
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
      undefined,
      syncEventSink,
    );

    return { value, invalidator };
  });

  const { value, invalidator } = containerState;

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

  return (
    <ApplicationContext.Provider value={value}>
      {children}
    </ApplicationContext.Provider>
  );
}
