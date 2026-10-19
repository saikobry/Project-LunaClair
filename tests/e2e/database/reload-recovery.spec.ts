import { test, expect, type Page } from '@playwright/test';
import { resetDatabase } from '../helpers/e2e-setup';

/**
 * Reload-recovery acceptance — the stale-bundle scenario, in a real Chromium.
 *
 * The guard under test (`DatabaseInitializer` → `DatabaseReloadScreen`) exists because a bundle
 * older than the stored database must refuse to open it: Dexie would otherwise patch the newer
 * schema down to the stale declaration, re-creating what the newer build retired. `fake-indexeddb`
 * cannot prove any of that — its patch semantics are not the browser's — so this spec runs the
 * real engine and asserts what the user actually experiences.
 *
 * The scenario is produced without shipping a second bundle: the "future build" is faked in the
 * page by opening the real database name (`lunaclair-db`) through raw IndexedDB at native version
 * 160 (Dexie stores declared v15 as 150). The app-under-test remains the genuine v15 bundle — its
 * declaration is what must refuse to open that database. The staged schema is made *divergent* on
 * purpose (a store the v15 declaration still requires does not exist): a schema-compatible
 * database could not distinguish "the guard refused" from "Dexie found nothing to patch", and a
 * real newer build's schema is never compatible with a retired store.
 *
 * Staging quirk worth knowing: the delete and the `open(160)` must run while **no app code runs
 * anywhere on the origin**. The SPA's Dexie auto-reopens on the next reactive query, so staging
 * from the live app upgrades the existing v15 database in place — a schema-compatible "future"
 * (native 160, all 19 v15 stores) that proves nothing. `gotoQuiescedPage` parks the tab on a
 * routed blank document: same origin (storage access works), but the app is unloaded —
 * `about:blank` itself would not do, being an opaque origin with no `indexedDB`. The staged shape
 * is asserted before control returns to the app.
 *
 * Recovery mirrors reality: reload only helps once the newer build is gone, so the spec
 * "uninstalls" it by deleting the stored database — after which the same bundle boots normally.
 * A reload while the mismatch is still stored lands back on the refusal screen, which is itself
 * asserted.
 */

const DB_NAME = 'lunaclair-db';

/** Raw IndexedDB open that reports the stored version and store list. */
function probeDatabase(page: Page, name: string): Promise<{ version: number; stores: string[] }> {
  return page.evaluate(
    (dbName) =>
      new Promise<{ version: number; stores: string[] }>((resolve) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          const result = {
            version: request.result.version,
            stores: Array.from(request.result.objectStoreNames).sort(),
          };
          request.result.close();
          resolve(result);
        };
        request.onerror = () => resolve({ version: -1, stores: [] });
      }),
    name,
  );
}

/**
 * Parks the tab on a same-origin document that runs none of the app, so IndexedDB staging sees
 * no app connection. Served by a Playwright route, not the dev server: Vite's SPA fallback would
 * answer an unknown path with the app itself.
 */
async function gotoQuiescedPage(page: Page): Promise<void> {
  await page.route('**/__e2e_quiesced__', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><body></body></html>',
    }),
  );
  await page.goto('/__e2e_quiesced__');
}

async function getActiveVaultDbName(page: Page): Promise<string> {
  return await page.evaluate(async () => {
    if (window.indexedDB.databases) {
      const dbs = await window.indexedDB.databases();
      const vault = dbs.find((d) => d.name?.startsWith('lc_vault_'));
      if (vault?.name) return vault.name;
    }
    return DB_NAME;
  });
}

async function deleteAllDatabases(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (window.indexedDB.databases) {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          await new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(db.name!);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          });
        }
      }
    }
  });
}

/**
 * Stages the stale-bundle world from scratch: the database a *divergent* newer build would have
 * left — native version 170, and a store set the current declaration cannot match.
 */
async function stageDivergentNewerDatabase(page: Page): Promise<string> {
  await gotoQuiescedPage(page);
  await deleteAllDatabases(page);

  const targetDbName = 'lc_vault_future';
  await page.evaluate(async (targetName) => {
    const regReq = indexedDB.open('lunaclair_registry', 1);
    await new Promise<void>((resolve, reject) => {
      regReq.onupgradeneeded = () => {
        regReq.result.createObjectStore('vaults', { keyPath: 'ownerSub' });
      };
      regReq.onsuccess = () => {
        const db = regReq.result;
        const tx = db.transaction('vaults', 'readwrite');
        tx.objectStore('vaults').put({
          ownerSub: 'ANONYMOUS',
          physicalDbName: targetName,
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      regReq.onerror = () => reject(regReq.error);
    });

    const targetReq = indexedDB.open(targetName, 170);
    await new Promise<void>((resolve, reject) => {
      targetReq.onupgradeneeded = () => {
        targetReq.result.createObjectStore('future_only_store', { keyPath: 'id' });
      };
      targetReq.onsuccess = () => {
        targetReq.result.close();
        resolve();
      };
      targetReq.onerror = () => reject(targetReq.error);
    });
  }, targetDbName);

  // Fail here, loudly, if the stage is not the divergent world the assertions below assume.
  const staged = await probeDatabase(page, targetDbName);
  expect(staged).toEqual({ version: 170, stores: ['future_only_store'] });
  return targetDbName;
}

test.describe('Reload recovery on database version mismatch', () => {
  test.afterEach(async ({ page }) => {
    // The spec deliberately leaves the stored database poisoned; clean it for the next spec.
    await gotoQuiescedPage(page);
    await deleteAllDatabases(page);
  });

  test('a newer build upgrading live closes this tab into the reload screen', async ({ page }) => {
    await resetDatabase(page);
    await page.goto('/library');
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible({
      timeout: 15000,
    });

    const dbName = await getActiveVaultDbName(page);

    // Another build wants to upgrade the stored database: Dexie's own versionchange close fires,
    // and the app must translate the dead connection into its screen — no reload needed to see it.
    await page.evaluate(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open(name, 170);
          request.onupgradeneeded = () => {
            request.result.createObjectStore('future_only_store', { keyPath: 'id' });
          };
          request.onsuccess = () => {
            request.result.close();
            resolve();
          };
          request.onerror = () => reject(request.error);
        }),
      dbName,
    );

    await expect(page.getByText('LunaClair was updated')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/your library and study progress are safe/i)).toBeVisible();

    // One recovery, no destructive alternatives.
    const reload = page.getByRole('button', { name: 'Reload LunaClair' });
    await expect(reload).toBeVisible();
    await expect(page.getByRole('button', { name: /reset|clear/i })).toHaveCount(0);

    // Reloading while the newer build is still installed lands on the refusal screen again —
    // the startup guard re-fires, because this bundle is still older than the stored database.
    await reload.click();
    await expect(page.getByText('LunaClair was updated')).toBeVisible({ timeout: 15000 });

    // Recovery: the "newer build is uninstalled" (its database deleted), and now the same
    // bundle boots normally onto its own schema.
    await page.evaluate(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
      dbName,
    );
    await reload.click();

    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible({
      timeout: 15000,
    });
    const restoredDbName = await getActiveVaultDbName(page);
    expect((await probeDatabase(page, restoredDbName)).version).toBe(160);
  });

  test('a database deleted underneath the running tab names the reset and still offers only reload', async ({
    page,
  }) => {
    await resetDatabase(page);
    await page.goto('/library');
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible({
      timeout: 15000,
    });

    const dbName = await getActiveVaultDbName(page);

    // What DevTools' "Delete database" and the e2e reset send: a version-less delete request.
    await page.evaluate((name) => {
      indexedDB.deleteDatabase(name);
    }, dbName);

    await expect(page.getByText('This tab lost its local database')).toBeVisible({
      timeout: 10000,
    });

    // Recovery is immediate here: there is no newer build to uninstall.
    await page.getByRole('button', { name: 'Reload LunaClair' }).click();
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible({
      timeout: 15000,
    });
  });

  test('a stale bundle boots straight into the reload screen and never patches the newer schema', async ({
    page,
  }) => {
    // The mismatch predates the app: the first render must already be the refusal.
    const stagedDbName = await stageDivergentNewerDatabase(page);

    await page.goto('/library');

    await expect(page.getByText('LunaClair was updated')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Reload LunaClair' })).toBeVisible();

    // The shell must not have appeared in the meantime — the screen is the whole app.
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toHaveCount(0);

    // And the guard is doing its job beyond the UI: the future database is still exactly what the
    // newer build left — same version, and the divergent store set unpatched. Had `db.open()` run,
    // Dexie would have re-created the missing `materials` store and bumped the version to 161.
    expect(await probeDatabase(page, stagedDbName)).toEqual({
      version: 170,
      stores: ['future_only_store'],
    });
  });
});
