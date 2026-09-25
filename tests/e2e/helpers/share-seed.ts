import { type Page, expect } from '@playwright/test';

import type { MaterialWorkspaceTab } from '../../../src/app/routing/routing';
import type { StudyPackage } from '../../../src/domain/package/models/package.types';

/**
 * Seeding helpers for the shares-only Explore contract.
 *
 * The library is seeded the same way a user builds it: through the live
 * `/api/shares` surface. A spec mocks the three endpoints the clone path calls
 * (feed, detail, download), then drives Explore → Clone → Open in the real UI —
 * it never hand-writes a `/materials/<id>` URL, because cloning remaps the
 * package's ids to fresh local ones and the resulting URL is the only correct
 * answer.
 *
 * Required setup order (each step matters):
 *
 * ```ts
 * await resetDatabase(page);            // clean IndexedDB + storage
 * await setupApiMocks(page);            // empty-feed default for every other request
 * await routeShare(page, fixture);      // registered AFTER, so the fixture feed wins
 * const workspaceUrl = await cloneShareToLibrary(page, fixture, 'write');
 * ```
 *
 * `setupApiMocks` installs an empty `/api/shares` feed as the default; Playwright
 * resolves routes last-registered-first, so `routeShare` must come after it or
 * Explore renders nothing.
 */

/** Workspace tab keys — the app's own union, so an invented tab fails here. */
export type WorkspaceTab = MaterialWorkspaceTab;

export interface ShareFixture {
  /** Share id served by `GET /api/shares/:id`. */
  shareId: string;
  /** Title rendered in Explore; specs locate the share by this text. */
  title: string;
  /** The `.lcpack` payload embedded in the share detail response. */
  package: StudyPackage;
  description?: string;
  author?: string;
  /** Defaults to the package's own `metadata.createdAt`. */
  createdAt?: string;
  viewCount?: number;
  downloadCount?: number;
}

const SHARE_FEED_ROUTE = /\/api\/shares(?:\?.*)?$/;
const SHARE_DETAIL_ROUTE = /\/api\/shares\/([^/?]+)$/;
const SHARE_DOWNLOAD_ROUTE = /\/api\/shares\/([^/?]+)\/download$/;

const JSON_HEADERS = { contentType: 'application/json' } as const;

/** Fixtures registered per page, so the feed can serve every share a spec declares. */
const fixturesByPage = new WeakMap<Page, ShareFixture[]>();
/** Pages whose three route handlers are already installed. */
const routeInstalled = new WeakSet<Page>();

function registeredFixtures(page: Page): ShareFixture[] {
  const existing = fixturesByPage.get(page);
  if (existing) return existing;
  const created: ShareFixture[] = [];
  fixturesByPage.set(page, created);
  return created;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shareIdFromUrl(url: string): string {
  const path = new URL(url).pathname;
  return path.split('/').filter(Boolean).pop() ?? '';
}

function createdAtOf(fixture: ShareFixture): string {
  return fixture.createdAt ?? fixture.package.metadata.createdAt;
}

function feedItem(fixture: ShareFixture) {
  return {
    id: fixture.shareId,
    format: 'lcpack',
    schemaVersion: 1,
    title: fixture.title,
    description: fixture.description ?? fixture.package.metadata.description ?? '',
    author: fixture.author ?? fixture.package.metadata.author ?? 'e2e_bot',
    viewCount: fixture.viewCount ?? 0,
    downloadCount: fixture.downloadCount ?? 0,
    createdAt: createdAtOf(fixture),
  };
}

function detailBody(fixture: ShareFixture) {
  const createdAt = createdAtOf(fixture);
  return {
    id: fixture.shareId,
    format: 'lcpack',
    schemaVersion: 1,
    title: fixture.title,
    description: fixture.description ?? fixture.package.metadata.description ?? '',
    author: fixture.author ?? fixture.package.metadata.author ?? 'e2e_bot',
    accessType: 'public',
    package: fixture.package,
    viewCount: fixture.viewCount ?? 0,
    downloadCount: fixture.downloadCount ?? 0,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Serves one fixture's share across the three live endpoints the clone path
 * calls. Safe to call once per fixture: the handlers are installed on the first
 * call and the feed serves every registered fixture afterwards, so a spec can
 * register several shares (see `explore-hub.spec.ts`).
 *
 * Must be called **after** `setupApiMocks`.
 */
export async function routeShare(page: Page, fixture: ShareFixture): Promise<void> {
  const fixtures = registeredFixtures(page);
  if (!fixtures.some((registered) => registered.shareId === fixture.shareId)) {
    fixtures.push(fixture);
  }

  if (routeInstalled.has(page)) return;
  routeInstalled.add(page);

  await page.route(SHARE_FEED_ROUTE, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();

    // `q` is real Worker behavior (GET /api/shares?q=…) and Explore treats it as
    // URL state, so the mock has to honor it for search assertions to mean anything.
    const q = (new URL(route.request().url()).searchParams.get('q') ?? '').trim().toLowerCase();
    const items = registeredFixtures(page)
      .map(feedItem)
      .filter(
        (item) =>
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.author.toLowerCase().includes(q),
      );

    return route.fulfill({
      status: 200,
      ...JSON_HEADERS,
      body: JSON.stringify({ items, nextCursor: null, hasMore: false }),
    });
  });

  await page.route(SHARE_DETAIL_ROUTE, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const fixture = registeredFixtures(page).find(
      (registered) => registered.shareId === shareIdFromUrl(route.request().url()),
    );
    if (!fixture) return route.fallback();

    return route.fulfill({ status: 200, ...JSON_HEADERS, body: JSON.stringify(detailBody(fixture)) });
  });

  await page.route(SHARE_DOWNLOAD_ROUTE, async (route) => {
    const fixture = registeredFixtures(page).find(
      (registered) => registered.shareId === shareIdFromUrl(route.request().url().replace('/download', '')),
    );
    if (!fixture) return route.fallback();

    return route.fulfill({
      status: 200,
      ...JSON_HEADERS,
      body: JSON.stringify({ success: true, downloadCount: (fixture.downloadCount ?? 0) + 1 }),
    });
  });
}

/**
 * Runs the real clone flow — Explore → Clone → Open in library — and returns the
 * live workspace URL on the requested tab.
 *
 * The URL is **captured, never constructed**: cloning remaps every package id to
 * a fresh local one, so `/materials/<uuid>?tab=…` cannot be predicted from the
 * fixture. The Open action lands on Read by default; this helper changes only
 * the captured URL's tab query after preserving the remapped material path.
 *
 * @returns the workspace URL, e.g. `http://localhost:5173/materials/<uuid>?tab=read`
 */
export async function cloneShareToLibrary(
  page: Page,
  fixture: ShareFixture,
  tab: WorkspaceTab = 'read',
): Promise<string> {
  const title = escapeRegExp(fixture.title);

  await page.goto('/explore');
  await expect(page.getByText(fixture.title).first()).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: new RegExp(`Clone\\s+${title}`, 'i') }).click();
  await expect(page.getByText(/In My Library/i).first()).toBeVisible({ timeout: 5000 });

  const openInLibrary = page.getByRole('button', {
    name: new RegExp(`Open\\s+${title}\\s+in your library`, 'i'),
  });
  await expect(openInLibrary).toBeVisible({ timeout: 5000 });
  await openInLibrary.click();

  // The library's Open action intentionally lands on Read. Preserve the
  // remapped material URL and only change its captured tab query so each spec
  // starts on the workspace surface it actually exercises.
  const capturedUrl = new URL(page.url());
  if (capturedUrl.searchParams.get('tab') !== tab) {
    capturedUrl.searchParams.set('tab', tab);
    await page.goto(capturedUrl.toString());
  }

  await expect(page).toHaveURL(new RegExp(`/materials/[^/?]+\\?tab=${tab}(?:&|$)`));
  return page.url();
}
