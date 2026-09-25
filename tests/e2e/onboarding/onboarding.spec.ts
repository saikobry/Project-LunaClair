import { test, expect } from '@playwright/test';
import { setupApiMocks } from '../helpers/e2e-setup';

const onboardingDoneKey = 'lunaclair.settings.onboarding_done';

test.describe('First-Run Onboarding E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.addInitScript((key) => {
      const marker = 'e2e.onboarding.initial-state';
      if (!sessionStorage.getItem(marker)) {
        localStorage.removeItem(key);
        sessionStorage.setItem(marker, '1');
      }
    }, onboardingDoneKey);
    await page.goto('/');
  });

  test('finishes the four-slide tutorial and keeps it dismissed after reload', async ({ page }) => {
    const onboardingDialog = page.getByRole('dialog');
    await expect(onboardingDialog).toBeVisible({ timeout: 10000 });
    await expect(
      onboardingDialog.getByRole('heading', { name: 'Welcome to LunaClair' }),
    ).toBeVisible();

    for (const title of ['Your library, your choice', 'Collections & quizzes', "You're all set"]) {
      await onboardingDialog.getByRole('button', { name: 'Next' }).click();
      await expect(onboardingDialog.getByRole('heading', { name: title })).toBeVisible();
    }

    await onboardingDialog.getByRole('button', { name: 'Finish' }).click();
    await expect(onboardingDialog).not.toBeVisible();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), onboardingDoneKey)).toBe('1');

    await page.reload();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('skips the tutorial on the first slide and keeps it dismissed after reload', async ({ page }) => {
    const onboardingDialog = page.getByRole('dialog');
    await expect(onboardingDialog).toBeVisible({ timeout: 10000 });
    await expect(
      onboardingDialog.getByRole('heading', { name: 'Welcome to LunaClair' }),
    ).toBeVisible();

    await onboardingDialog.getByRole('button', { name: 'Skip' }).click();
    await expect(onboardingDialog).not.toBeVisible();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), onboardingDoneKey)).toBe('1');

    await page.reload();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
