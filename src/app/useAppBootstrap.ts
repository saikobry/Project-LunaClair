import { useCallback, useEffect, useState } from 'react';
import { bootstrapApplication } from './bootstrap';
import { reloadWithFreshServiceWorker } from './serviceWorkerUpdate';
import { db } from '../infrastructure/database/schema/LunaClairDatabase';
import {
  DatabaseReloadRequiredError,
  type DatabaseReloadReason,
} from '../infrastructure/database/schema/databaseLifecycle';

export type AppBootstrapStatus = 'loading' | 'ready';

export interface AppBootstrapState {
  status: AppBootstrapStatus;
  /** Non-null when this tab can no longer use its local database and needs a reload. */
  reloadReason: DatabaseReloadReason | null;
  /** Requests a fresh service worker, then reloads. Idempotent enough to be clicked twice. */
  requestReload: () => void;
}

/**
 * Startup state machine for the app shell: `loading → ready`, with a side exit into a reload state.
 *
 * Two database failures land here instead of becoming a permanent blank screen, which is what the app
 * used to do (bootstrap had no error path, and `App` renders nothing until it reports ready):
 *
 * - the stored database is **newer** than this bundle, which `DatabaseInitializer` refuses *before*
 *   opening — Dexie would otherwise patch the newer schema back to this build's declaration — and
 *   reports as `DatabaseReloadRequiredError` (the `catch` below);
 * - this build is **blocked** by an older connection holding the upgrade, which leaves `db.open()`
 *   pending forever rather than rejecting — hence the subscription, which must be registered *before*
 *   the open so a blocked startup still reaches the UI.
 *
 * A failure that is neither is logged and left alone: it is a bug, and a reload prompt would mislabel
 * it. The library is never touched from here — no reset, no database deletion.
 */
export function useAppBootstrap(): AppBootstrapState {
  const [status, setStatus] = useState<AppBootstrapStatus>('loading');
  const [reloadReason, setReloadReason] = useState<DatabaseReloadReason | null>(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = db.onReloadRequired((reason) => {
      if (active) setReloadReason(reason);
    });

    bootstrapApplication()
      .then(() => {
        if (active) setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;

        if (error instanceof DatabaseReloadRequiredError) {
          setReloadReason(error.reason);
          return;
        }

        console.error('LunaClair failed to start', error);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const requestReload = useCallback(() => {
    void reloadWithFreshServiceWorker();
  }, []);

  return { status, reloadReason, requestReload };
}
