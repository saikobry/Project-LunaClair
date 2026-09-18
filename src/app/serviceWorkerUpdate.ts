/**
 * Service-worker update helpers for the reload path.
 *
 * Kept apart from the UI so the reload screen stays presentational and the "ask for a fresh worker,
 * then reload" policy has one home. None of it is required for correctness: when there is no service
 * worker (dev, or a non-PWA context) `reloadWithFreshServiceWorker` still reloads, which is the actual
 * recovery. Nothing here may ever delete or recreate the database.
 */

/** Upper bound on waiting for a freshly installed worker before reloading anyway. */
const WORKER_READY_TIMEOUT_MS = 1500;

/**
 * Asks the browser to check for a new service worker. Best-effort by contract: an update failure must
 * never block the reload that follows, so every failure path resolves to `null`.
 */
export async function requestServiceWorkerUpdate(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    await registration.update();
    return registration;
  } catch {
    return null;
  }
}

/**
 * Reloads onto the newest available build.
 *
 * A worker already `waiting` activates on the next navigation, so there is nothing to wait for. One
 * still `installing` is awaited briefly first, because reloading while the old script is still active
 * can serve the very bundle the reload is escaping — bounded, since a stalled install must not trap
 * the user on this screen.
 */
export async function reloadWithFreshServiceWorker(): Promise<void> {
  const registration = await requestServiceWorkerUpdate();
  await waitForInstallingWorker(registration);
  window.location.reload();
}

function waitForInstallingWorker(registration: ServiceWorkerRegistration | null): Promise<void> {
  const worker = registration?.installing;
  if (!worker) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', handleStateChange);
      resolve();
    };

    const handleStateChange = () => {
      if (worker.state === 'installed' || worker.state === 'activated' || worker.state === 'redundant') {
        finish();
      }
    };

    const timer = setTimeout(finish, WORKER_READY_TIMEOUT_MS);
    worker.addEventListener('statechange', handleStateChange);
    handleStateChange();
  });
}
