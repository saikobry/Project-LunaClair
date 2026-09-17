import { test, expect } from '@playwright/test';
import { setupApiMocks, resetDatabase } from '../helpers/e2e-setup';

/**
 * Explore hub acceptance — shares-only contract.
 *
 * Explore surfaces published `.lcpack` shares exclusively (the official catalog
 * and the Official/Community source filter were retired), and its filters are
 * URL state (`/explore?q=&sort=`), so the assertions cover the URL as well as
 * the rendered list.
 *
 * Badges: every mocked share renders as "Community". The "Verified Course"
 * badge is unreachable in production because `GET /api/shares` does not return
 * an `isVerified` field (no such D1 column) — see
 * docs/architecture/plans/explore-hub-overhaul-plan.md §3.1. Do not assert it
 * here until the API actually supplies it.
 */
test.describe('Explore Discovery Hub E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);

    // Mock the public shares feed
    await page.route(/\/api\/shares(?:\?.*)?$/, async (route) => {
      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url());
        const q = (url.searchParams.get('q') || '').toLowerCase();

        const allShares = [
          {
            id: 'share_community_mcat',
            format: 'lcpack',
            schemaVersion: 1,
            title: 'MCAT High-Yield Biology',
            description: 'Essential flashcards and high-yield questions for MCAT prep.',
            author: 'sarah_med',
            viewCount: 320,
            downloadCount: 142,
            createdAt: '2026-08-28T00:00:00.000Z',
          },
          {
            id: 'share_community_orgo',
            format: 'lcpack',
            schemaVersion: 1,
            title: 'Organic Chemistry Reactions Deck',
            description: 'Reaction mechanisms, reagents, and retrosynthesis problems.',
            author: 'alex_chem',
            viewCount: 180,
            downloadCount: 78,
            createdAt: '2026-08-27T00:00:00.000Z',
          },
        ];

        const filtered = allShares.filter(
          (s) =>
            !q ||
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.author.toLowerCase().includes(q),
        );

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: filtered, nextCursor: null, hasMore: false }),
        });
      }
      return route.fallback();
    });

    // Single share fetch + download tracking for cloning
    await page.route(/\/api\/shares\/share_community_mcat$/, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'share_community_mcat',
          format: 'lcpack',
          schemaVersion: 1,
          title: 'MCAT High-Yield Biology',
          description: 'Essential flashcards and high-yield questions for MCAT prep.',
          author: 'sarah_med',
          accessType: 'public',
          package: {
            format: 'lcpack',
            schemaVersion: 1,
            metadata: {
              title: 'MCAT High-Yield Biology',
              description: 'Essential flashcards and high-yield questions for MCAT prep.',
              author: 'sarah_med',
              createdAt: '2026-08-28T00:00:00.000Z',
            },
            materials: [
              {
                id: 'pkg_mat_mcat1',
                title: 'MCAT High-Yield Biology',
                documentContent: '# MCAT Biology Notes\n\nHigh-yield organ systems summary.',
              },
            ],
            questions: [],
            quizzes: [],
          },
          viewCount: 321,
          downloadCount: 142,
          createdAt: '2026-08-28T00:00:00.000Z',
          updatedAt: '2026-08-28T00:00:00.000Z',
        }),
      });
    });

    await page.route(/\/api\/shares\/share_community_mcat\/download$/, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, downloadCount: 143 }),
      });
    });
  });

  test('lists shares, searches through the URL, sorts, and clones into the library', async ({ page }) => {
    // 1. Open the hub
    await page.goto('/explore');

    await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('MCAT High-Yield Biology')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Organic Chemistry Reactions Deck')).toBeVisible({ timeout: 10000 });

    // Shares-only: community badge + author, and no retired source filters.
    await expect(page.getByText('Community').first()).toBeVisible();
    await expect(page.getByText('sarah_med')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Official' })).toHaveCount(0);

    // The card's open control is a real <button> whose accessible name is the
    // visible title. The retired markup was a `role="button"` shell labelled
    // `View share …`, which cannot satisfy an exact title match.
    await expect(
      page.getByRole('button', { name: 'MCAT High-Yield Biology', exact: true }),
    ).toBeVisible();

    // 2. Search is URL state, and it is debounced (one commit, not one per key)
    const searchInput = page.getByPlaceholder(/Search study packages, authors/i);
    await searchInput.fill('retrosynthesis');

    await expect(page).toHaveURL(/\/explore\?q=retrosynthesis/);
    await expect(page.getByText('Organic Chemistry Reactions Deck')).toBeVisible();
    await expect(page.getByText('MCAT High-Yield Biology')).not.toBeVisible();

    // 3. Back restores the previous filter state (URL is the source of truth)
    await page.goBack();
    await expect(page.getByText('MCAT High-Yield Biology')).toBeVisible({ timeout: 10000 });

    // 4. Sort is the shared segmented control (a radiogroup), and still URL state — the default stays out of the URL
    await expect(page.getByText('2 results')).toBeVisible();
    await page.getByRole('radio', { name: 'Recent' }).click();
    await expect(page).toHaveURL(/sort=recent/);

    // 5. 1-click clone → toast + In My Library
    const cloneBtn = page.getByRole('button', { name: /Clone MCAT High-Yield Biology/i });
    await cloneBtn.click();

    await expect(page.getByText(/Cloned "MCAT High-Yield Biology" into library!/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/In My Library/i).first()).toBeVisible({ timeout: 5000 });

    // 5b. A cloned share is not a dead end: its action becomes the next step
    // into the local library (the Clone control is gone), and it lands on the
    // material workspace — not the share landing surface.
    await expect(page.getByRole('button', { name: /Clone MCAT High-Yield Biology/i })).toHaveCount(0);
    const openInLibrary = page.getByRole('button', {
      name: /Open MCAT High-Yield Biology in your library/i,
    });
    await expect(openInLibrary).toBeVisible();
    await openInLibrary.click();

    await expect(page).toHaveURL(/\/materials\/[^/?]+\?tab=read/);

  });

  test('remembers the hub as the origin of an opened share, so Back keeps the filters', async ({ page }) => {
    // A filtered hub view: the filters are URL state, which is exactly what is
    // at risk of being dropped when you open a package from here.
    await page.goto('/explore?q=biology');
    await expect(page.getByText('MCAT High-Yield Biology')).toBeVisible({ timeout: 10000 });

    // Open the share from its title control: the origin is stamped in the URL as
    // its own route, so the hub's query survives the trip.
    await page.getByRole('button', { name: 'MCAT High-Yield Biology', exact: true }).click();
    await expect(page).toHaveURL(/\/share\/share_community_mcat\?from=%2Fexplore%3Fq%3Dbiology/);
    await expect(page.getByText('Package Contents')).toBeVisible({ timeout: 10000 });

    // The trail names the origin (not the Library) and ends with the package
    // itself, like the material workspace trail does.
    await expect(page.getByLabel('Breadcrumb')).toContainText('MCAT High-Yield Biology');

    // It leads back to the hub view the user actually came from.
    await page.getByLabel('Breadcrumb').getByRole('button', { name: 'Explore' }).click();
    await expect(page).toHaveURL(/\/explore\?q=biology/);
    await expect(page.getByText('MCAT High-Yield Biology')).toBeVisible({ timeout: 10000 });
  });
});
