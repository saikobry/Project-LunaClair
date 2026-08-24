import { test, expect } from '@playwright/test';
import { setupImportedMaterial, switchToRawMode, locators } from '../helpers/e2e-setup';

test.describe('Writer E2E — P0 Writer-to-Reader Synchronization & Visual Formatting', () => {
  test('persists formatted markdown from Writer and verifies high-fidelity styled rendering in Reader', async ({ page }) => {
    await setupImportedMaterial(page, 'cell-structure');

    // Switch to Raw Markdown mode and type formatted content
    const textarea = await switchToRawMode(page);
    const formattedMarkdown = `# Heading Formatted Content\n\nThis is **StrongBoldTarget** and this is *EmphasisItalicTarget*.\n\nEnd of section.`;
    await textarea.fill(formattedMarkdown);

    // Save changes
    await locators.saveBtn(page).click();
    await expect(locators.savedBadge(page)).toBeVisible({ timeout: 10000 });

    // Switch to Read tab
    await locators.readTab(page).click();

    // Verify Reader is active and document is rendered inside tabpanel
    const tabpanel = page.getByRole('tabpanel');
    await expect(tabpanel.getByRole('heading', { name: 'Heading Formatted Content' })).toBeVisible({ timeout: 10000 });

    // 1. Assert bold element exists and has visual bold styling (font-weight >= 600)
    const strongElement = tabpanel.locator('strong, b').filter({ hasText: 'StrongBoldTarget' });
    await expect(strongElement).toBeVisible();
    const fontWeight = await strongElement.evaluate((el) => window.getComputedStyle(el).fontWeight);
    expect(Number.parseInt(fontWeight, 10) >= 600 || fontWeight === 'bold').toBeTruthy();

    // 2. Assert italic element exists and has visual italic styling (font-style: italic)
    const emElement = tabpanel.locator('em, i').filter({ hasText: 'EmphasisItalicTarget' });
    await expect(emElement).toBeVisible();
    const fontStyle = await emElement.evaluate((el) => window.getComputedStyle(el).fontStyle);
    expect(fontStyle).toBe('italic');

    // 3. Assert no literal markdown asterisks are rendered as plain text to the user
    await expect(tabpanel).not.toContainText('**StrongBoldTarget**');
    await expect(tabpanel).not.toContainText('*EmphasisItalicTarget*');
  });

  test('persists formatted markdown through reload and verifies Reader renders from Dexie', async ({ page }) => {
    await setupImportedMaterial(page, 'cell-structure');

    // Switch to Raw Markdown mode and type formatted content
    const textarea = await switchToRawMode(page);
    const formattedMarkdown = `# Reload Persistence Test\n\nThis is **BoldAfterReload** and this is *ItalicAfterReload*.\n\nEnd.`;
    await textarea.fill(formattedMarkdown);

    // Save changes
    await locators.saveBtn(page).click();
    await expect(locators.savedBadge(page)).toBeVisible({ timeout: 10000 });

    // Reload the page — Dexie should persist the content
    await page.reload();

    // Wait for the app to rehydrate from Dexie
    await expect(locators.savedBadge(page)).toBeVisible({ timeout: 10000 });

    // Switch to Read tab
    await locators.readTab(page).click();

    // Verify Reader renders the persisted content from Dexie
    const tabpanel = page.getByRole('tabpanel');
    await expect(tabpanel.getByRole('heading', { name: 'Reload Persistence Test' })).toBeVisible({ timeout: 10000 });

    // Assert bold styling survived reload
    const strongElement = tabpanel.locator('strong, b').filter({ hasText: 'BoldAfterReload' });
    await expect(strongElement).toBeVisible();
    const fontWeight = await strongElement.evaluate((el) => window.getComputedStyle(el).fontWeight);
    expect(Number.parseInt(fontWeight, 10) >= 600 || fontWeight === 'bold').toBeTruthy();

    // Assert italic styling survived reload
    const emElement = tabpanel.locator('em, i').filter({ hasText: 'ItalicAfterReload' });
    await expect(emElement).toBeVisible();
    const fontStyle = await emElement.evaluate((el) => window.getComputedStyle(el).fontStyle);
    expect(fontStyle).toBe('italic');

    // Assert no literal markdown syntax rendered
    await expect(tabpanel).not.toContainText('**BoldAfterReload**');
    await expect(tabpanel).not.toContainText('*ItalicAfterReload*');
  });
});
