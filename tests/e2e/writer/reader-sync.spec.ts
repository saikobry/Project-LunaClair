import { test, expect } from '@playwright/test';
import { resetDatabase, setupApiMocks, switchToRawMode, switchToReadMode, locators } from '../helpers/e2e-setup';
import { cloneShareToLibrary, routeShare } from '../helpers/share-seed';
import { cellularRespiration } from '../helpers/fixtures/cellularRespiration';

test.describe('Writer E2E — P0 Writer-to-Reader Synchronization & Visual Formatting', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);
    await routeShare(page, cellularRespiration);
    await cloneShareToLibrary(page, cellularRespiration, 'write');
  });

  test('persists formatted markdown from Writer and verifies high-fidelity styled rendering in Reader', async ({ page }) => {
    // Switch to Raw Markdown mode and type formatted content
    const textarea = await switchToRawMode(page);
    const formattedMarkdown = `# Heading Formatted Content\n\nThis is **StrongBoldTarget** and this is *EmphasisItalicTarget*.\n\nEnd of section.`;
    await textarea.fill(formattedMarkdown);

    // Save changes
    await locators.saveBtn(page).click();
    await expect(locators.savedBadge(page)).toBeVisible({ timeout: 10000 });

    // Switch to Read tab
    await switchToReadMode(page);

    // Scope assertions to the rendered markdown. The workspace keeps visited
    // panels mounted, so the outer tabpanel also contains the hidden writer.
    const markdown = page.locator('.markdown-viewer');
    await expect(markdown.getByRole('heading', { name: 'Heading Formatted Content' })).toBeVisible({ timeout: 10000 });

    // 1. Assert bold element exists and has visual bold styling (font-weight >= 600)
    const strongElement = markdown.locator('strong, b').filter({ hasText: 'StrongBoldTarget' });
    await expect(strongElement).toBeVisible();
    const fontWeight = await strongElement.evaluate((el) => window.getComputedStyle(el).fontWeight);
    expect(Number.parseInt(fontWeight, 10) >= 600 || fontWeight === 'bold').toBeTruthy();

    // 2. Assert italic element exists and has visual italic styling (font-style: italic)
    const emElement = markdown.locator('em, i').filter({ hasText: 'EmphasisItalicTarget' });
    await expect(emElement).toBeVisible();
    const fontStyle = await emElement.evaluate((el) => window.getComputedStyle(el).fontStyle);
    expect(fontStyle).toBe('italic');

    // 3. Assert no literal markdown asterisks are rendered as plain text to the user
    await expect(markdown).not.toContainText('**StrongBoldTarget**');
    await expect(markdown).not.toContainText('*EmphasisItalicTarget*');
  });

  test('persists formatted markdown through reload and verifies Reader renders from Dexie', async ({ page }) => {
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
    await switchToReadMode(page);

    // Verify Reader renders the persisted content from Dexie. The workspace
    // keeps visited panels mounted, so scope to the markdown viewer itself.
    const markdown = page.locator('.markdown-viewer');
    await expect(markdown.getByRole('heading', { name: 'Reload Persistence Test' })).toBeVisible({ timeout: 10000 });

    // Assert bold styling survived reload
    const strongElement = markdown.locator('strong, b').filter({ hasText: 'BoldAfterReload' });
    await expect(strongElement).toBeVisible();
    const fontWeight = await strongElement.evaluate((el) => window.getComputedStyle(el).fontWeight);
    expect(Number.parseInt(fontWeight, 10) >= 600 || fontWeight === 'bold').toBeTruthy();

    // Assert italic styling survived reload
    const emElement = markdown.locator('em, i').filter({ hasText: 'ItalicAfterReload' });
    await expect(emElement).toBeVisible();
    const fontStyle = await emElement.evaluate((el) => window.getComputedStyle(el).fontStyle);
    expect(fontStyle).toBe('italic');

    // Assert no literal markdown syntax rendered
    await expect(markdown).not.toContainText('**BoldAfterReload**');
    await expect(markdown).not.toContainText('*ItalicAfterReload*');
  });
});
