import { test, expect } from '@playwright/test';
import { setupApiMocks, resetDatabase } from '../helpers/e2e-setup';

test.describe('Explore Discovery Hub E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);

    // Mock public shares endpoint for community content
    await page.route(/\/api\/shares(?:\?.*)?$/, async (route) => {
      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url());
        const q = (url.searchParams.get('q') || '').toLowerCase();

        const allCommunityShares = [
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

        const filtered = allCommunityShares.filter(
          (s) =>
            !q ||
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.author.toLowerCase().includes(q),
        );

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: filtered,
            nextCursor: null,
            hasMore: false,
          }),
        });
      }
      return route.fallback();
    });

    // Mock single share fetch & download for cloning
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

  test('navigates to /explore, filters by source, searches, previews official material, and clones community deck', async ({ page }) => {
    // 1. Open Explore page
    await page.goto('/explore');

    // 2. Assert page header and cards are visible
    await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Cell Structure & Function')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('MCAT High-Yield Biology')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Organic Chemistry Reactions Deck')).toBeVisible({ timeout: 10000 });

    // Assert badges
    await expect(page.getByText('Verified Course').first()).toBeVisible();
    await expect(page.getByText('sarah_med')).toBeVisible();

    // 3. Test Source Filters: Click "Official" tab
    const officialTab = page.getByRole('radio', { name: 'Official' });
    await officialTab.click();

    await expect(page.getByText('Cell Structure & Function')).toBeVisible();
    await expect(page.getByText('MCAT High-Yield Biology')).not.toBeVisible();

    // Click "Community" tab
    const communityTab = page.getByRole('radio', { name: 'Community' });
    await communityTab.click();

    await expect(page.getByText('Cell Structure & Function')).not.toBeVisible();
    await expect(page.getByText('MCAT High-Yield Biology')).toBeVisible();
    await expect(page.getByText('Organic Chemistry Reactions Deck')).toBeVisible();

    // 4. Test Search
    const searchInput = page.getByPlaceholder(/Search materials, subjects, authors/i);
    await searchInput.fill('retrosynthesis');

    await expect(page.getByText('Organic Chemistry Reactions Deck')).toBeVisible();
    await expect(page.getByText('MCAT High-Yield Biology')).not.toBeVisible();

    // Clear search and switch to All
    await searchInput.fill('');
    const allTab = page.getByRole('radio', { name: 'All' });
    await allTab.click();

    // 5. Test 1-Click Clone on Community Deck
    await expect(page.getByText('MCAT High-Yield Biology')).toBeVisible();
    const cloneBtn = page.getByRole('button', { name: /Clone/i }).first();
    await cloneBtn.click();

    // Assert Toast confirmation and In My Library badge
    await expect(page.getByText(/Cloned "MCAT High-Yield Biology" into library!/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/In My Library/i).first()).toBeVisible({ timeout: 5000 });

    // 6. Test Legacy URL alias: navigating to /available redirects to /explore
    await page.goto('/available');
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  });
});
