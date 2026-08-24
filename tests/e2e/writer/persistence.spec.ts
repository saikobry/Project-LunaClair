import { test, expect } from '@playwright/test';
import { setupImportedMaterial, switchToRawMode, locators } from '../helpers/e2e-setup';

test.describe('Writer E2E — P0 Reload Persistence & Real IndexedDB', () => {
  test('saves content to local Dexie and preserves edited markdown across browser reload (F5)', async ({ page }) => {
    await setupImportedMaterial(page, 'cell-structure');

    // Switch to Raw Markdown mode for precise text insertion
    const textarea = await switchToRawMode(page);

    const timestamp = Date.now();
    const testContent = `# E2E Persistence Validation\n\nUnique test token: ${timestamp}\n\nThis content must survive page refresh.`;

    await textarea.fill(testContent);

    // Verify status badge updates to unsaved
    await expect(locators.unsavedBadge(page)).toBeVisible();

    // Click Save Changes
    const saveBtn = locators.saveBtn(page);
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Verify status badge transitions to Saved to Library
    await expect(locators.savedBadge(page)).toBeVisible({ timeout: 10000 });

    // Execute browser page reload (F5)
    await page.reload();

    // Wait for the status badge to confirm the app rehydrated from IndexedDB
    await expect(locators.savedBadge(page)).toBeVisible({ timeout: 10000 });

    // Switch to Raw mode if in visual mode
    const reloadedTextarea = await switchToRawMode(page);

    // Assert that the persisted content survived the reload intact
    await expect(reloadedTextarea).toHaveValue(testContent);
  });
});
