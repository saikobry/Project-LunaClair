import { test, expect } from '@playwright/test';
import { setupImportedMaterial, switchToRawMode, switchToVisualMode, locators } from '../helpers/e2e-setup';

test.describe('Writer E2E — P1 Visual <-> Raw Mode Switching & Content Preservation', () => {
  test('seamlessly synchronizes content from Raw to Visual and back', async ({ page }) => {
    await setupImportedMaterial(page, 'cell-structure');

    // 1. Toggle to Raw mode and type content
    const textarea = await switchToRawMode(page);
    const markdownList = `# List Structure Verification\n\n- Primary Item 1\n- Primary Item 2\n- Primary Item 3`;
    await textarea.fill(markdownList);

    // 2. Toggle to Visual Editor
    const editor = await switchToVisualMode(page);

    // 3. Verify Visual Editor displays rendered list items
    await expect(editor.locator('li')).toHaveCount(3);
    await expect(editor).toContainText('Primary Item 1');

    // 4. Toggle back to Raw mode and verify markdown is intact
    await switchToRawMode(page);
    await expect(textarea).toHaveValue(markdownList);

    // 5. Save and verify
    await locators.saveBtn(page).click();
    await expect(locators.savedBadge(page)).toBeVisible({ timeout: 10000 });
  });

  test('preserves content through Visual → Raw → Visual mode switching', async ({ page }) => {
    await setupImportedMaterial(page, 'cell-structure');

    // 1. Ensure we are in Visual Editor
    const editor = await switchToVisualMode(page);

    // 2. Type a representative document with multiple formatting types
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');

    // Type structured content
    await page.keyboard.type('Visual Mode Test');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Paragraph A with some text.');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Item 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Item 2');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Bold and italic content');

    // 3. Toggle to Raw mode and verify content
    const textarea = await switchToRawMode(page);

    // The textarea should contain our typed content (markdown may be normalized)
    const rawContent = await textarea.inputValue();
    expect(rawContent).toContain('Visual Mode Test');
    expect(rawContent).toContain('Paragraph A with some text');
    expect(rawContent).toContain('Item 1');
    expect(rawContent).toContain('Item 2');
    expect(rawContent).toContain('Bold and italic content');

    // 4. Toggle back to Visual mode and verify content persisted
    const editorAgain = await switchToVisualMode(page);
    await expect(editorAgain).toContainText('Visual Mode Test');
    await expect(editorAgain).toContainText('Paragraph A with some text');
    await expect(editorAgain).toContainText('Item 1');
    await expect(editorAgain).toContainText('Item 2');
    await expect(editorAgain).toContainText('Bold and italic content');
  });
});
