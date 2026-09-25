import { test, expect } from '@playwright/test';
import { resetDatabase, setupApiMocks, switchToRawMode, locators } from '../helpers/e2e-setup';
import { cloneShareToLibrary, routeShare } from '../helpers/share-seed';
import { cellStructure } from '../helpers/fixtures/cellStructure';
import { cellularRespiration } from '../helpers/fixtures/cellularRespiration';

/**
 * NOTE: These tests use synthetic `pushState + popstate` to simulate material
 * switching because the real navigation flow (sidebar → subject page → material
 * card) always sets `activeTab: 'read'`, which unmounts MaterialWriterTab entirely.
 *
 * The synthetic approach correctly tests MaterialWriterTab's internal protection:
 * it verifies that when `materialId` prop changes while the Writer stays mounted,
 * the component detects the dirty state and shows the UnsavedChangesModal.
 *
 * For full production confidence, routing-level unsaved-changes protection is
 * needed (e.g., a global `beforeRouteChange` guard that checks for dirty writers).
 */
function localMaterialId(workspaceUrl: string): string {
  const materialId = new URL(workspaceUrl).pathname.split('/').filter(Boolean).at(-1);
  if (!materialId) throw new Error(`Workspace URL did not contain a material id: ${workspaceUrl}`);
  return materialId;
}

test.describe('Writer E2E — P1 Unsaved Material Navigation & beforeunload Protection', () => {
  let cellularRespirationUrl = '';

  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);
    await routeShare(page, cellStructure);
    await routeShare(page, cellularRespiration);

    const cellStructureUrl = await cloneShareToLibrary(page, cellStructure, 'write');
    cellularRespirationUrl = await cloneShareToLibrary(page, cellularRespiration, 'write');
    await page.goto(cellStructureUrl);
  });

  test('protects dirty drafts on material switch and stays in editor upon cancellation', async ({ page }) => {
    // Switch to Raw Markdown mode and make dirty changes
    const textarea = await switchToRawMode(page);
    await textarea.fill('# Crucial Unsaved Draft Work');
    await expect(locators.unsavedBadge(page)).toBeVisible();

    // Simulate material switch via synthetic route change
    // This tests MaterialWriterTab's internal protection when materialId prop changes
    await page.evaluate((targetId) => {
      window.history.pushState(null, '', `/materials/${targetId}?tab=write`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, localMaterialId(cellularRespirationUrl));

    // Confirmation dialog MUST appear
    const modal = page.locator('dialog').filter({ hasText: 'Unsaved Changes' });
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByRole('heading', { name: 'Unsaved Changes' })).toBeVisible();
    await expect(modal.getByText(/You have unsaved changes/i)).toBeVisible();

    // Click "Stay in Editor"
    await modal.getByRole('button', { name: /Stay in Editor/i }).click();

    // Modal closes
    await expect(modal).not.toBeVisible();

    // Assert active editor remained on original unsaved draft
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue('# Crucial Unsaved Draft Work');
    await expect(locators.unsavedBadge(page)).toBeVisible();
  });

  test('discards dirty draft and transitions to new material upon confirmation', async ({ page }) => {


    // Switch to Raw Markdown mode and make dirty changes
    const textarea = await switchToRawMode(page);
    await textarea.fill('# Discardable Unsaved Work');
    await expect(locators.unsavedBadge(page)).toBeVisible();

    // Simulate material switch via synthetic route change
    await page.evaluate((targetId) => {
      window.history.pushState(null, '', `/materials/${targetId}?tab=write`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, localMaterialId(cellularRespirationUrl));

    // Confirmation dialog MUST appear
    const modal = page.locator('dialog').filter({ hasText: 'Unsaved Changes' });
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByRole('heading', { name: 'Unsaved Changes' })).toBeVisible();

    // Click "Discard & Switch"
    await modal.getByRole('button', { name: /Discard & Switch/i }).click();

    // Modal closes
    await expect(modal).not.toBeVisible();

    // Assert new material is active in workspace and old draft is gone
    await expect(locators.savedBadge(page)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Cellular Respiration/i, level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test('guards against accidental page reloads/closes via beforeunload listener when dirty', async ({ page }) => {


    // 1. In clean state, dispatch beforeunload -> must NOT be prevented
    const isCleanPrevented = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(isCleanPrevented).toBe(false);

    // 2. Switch to Raw mode and create dirty edits
    const textarea = await switchToRawMode(page);
    await textarea.fill('# Dirty Work For Unload Check');
    await expect(locators.unsavedBadge(page)).toBeVisible();

    // 3. In dirty state, dispatch beforeunload -> MUST be prevented
    const isDirtyPrevented = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(isDirtyPrevented).toBe(true);
  });
});
