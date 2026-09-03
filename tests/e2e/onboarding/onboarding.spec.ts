import { test, expect } from '@playwright/test';
import { setupApiMocks } from '../helpers/e2e-setup';

test.describe('First-Run Onboarding & Academic Term Initialization E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.evaluate(async () => {
      if (window.indexedDB) {
        await new Promise<void>((resolve) => {
          const req = window.indexedDB.deleteDatabase('lunaclair-db');
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
      }
      localStorage.clear();
    });
  });

  test('presents onboarding welcome to fresh users, initializes default terms upon dismissal, and persists across reload', async ({
    page,
  }) => {
    // 1. Fresh user visits application root
    await page.goto('/');

    // 2. Welcome dialog appears
    const onboardingDialog = page.getByRole('dialog');
    await expect(onboardingDialog).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('heading', { name: 'Welcome to LunaClair' }),
    ).toBeVisible();

    // 3. User skips/completes onboarding
    const skipButton = page.getByRole('button', { name: 'Skip' });
    await expect(skipButton).toBeVisible();
    await skipButton.click();

    // 4. Onboarding modal unmounts
    await expect(onboardingDialog).not.toBeVisible();

    // 5. Navigate to Academic Terms to verify default terms were initialized
    await page.goto('/terms');

    // 6. User observes the 3 default academic terms in the UI
    await expect(page.getByText('Prelim')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Midterm')).toBeVisible();
    await expect(page.getByText('Finals')).toBeVisible();

    // 7. Reload page to verify persistence
    await page.reload();

    // 8. Onboarding modal does not reappear
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // 9. Initialized terms remain available
    await expect(page.getByText('Prelim')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Midterm')).toBeVisible();
    await expect(page.getByText('Finals')).toBeVisible();
  });
});
