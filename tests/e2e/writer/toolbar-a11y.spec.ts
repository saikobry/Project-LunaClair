import { test, expect } from '@playwright/test';
import { setupImportedMaterial, switchToVisualMode, locators } from '../helpers/e2e-setup';

test.describe('Writer E2E — P2 Toolbar Accessibility & Selection Preservation', () => {
  test('validates accessible toolbar role, all inline toggle button labels, pressed states, and action buttons', async ({ page }) => {
    await setupImportedMaterial(page, 'cell-structure');

    // Ensure we are in Visual Editor mode
    await switchToVisualMode(page);

    // 1. Verify toolbar accessible role and name
    const toolbar = page.getByRole('toolbar', { name: 'Formatting' });
    await expect(toolbar).toBeVisible();

    // 2. Verify all 6 toggle formatting buttons exist with accessible names and initial aria-pressed="false"
    const toggleButtons = [
      { expectedLabel: 'Bold' },
      { expectedLabel: 'Italic' },
      { expectedLabel: 'Underline' },
      { expectedLabel: 'Strikethrough' },
      { expectedLabel: 'Inline Code' },
      { expectedLabel: 'Link' },
    ];

    for (const { expectedLabel } of toggleButtons) {
      const btn = toolbar.getByRole('button', { name: expectedLabel });
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('aria-pressed', 'false');
    }

    // 3. Verify action buttons exist with accessible labels and do NOT have aria-pressed
    const undoBtn = toolbar.getByRole('button', { name: 'Undo' });
    await expect(undoBtn).toBeVisible();
    await expect(undoBtn).not.toHaveAttribute('aria-pressed');

    const redoBtn = toolbar.getByRole('button', { name: 'Redo' });
    await expect(redoBtn).toBeVisible();
    await expect(redoBtn).not.toHaveAttribute('aria-pressed');

    // 4. Focus editor and click Bold -> verify Bold transitions to aria-pressed="true"
    const boldBtn = toolbar.getByRole('button', { name: 'Bold' });
    const editor = locators.editor(page);
    await editor.click();
    await boldBtn.click();

    await expect(boldBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('applies bold formatting to selected text and preserves unselected text', async ({ page }) => {
    await setupImportedMaterial(page, 'cell-structure');

    // Switch to Visual Editor mode
    const editor = await switchToVisualMode(page);

    // Clear editor and type test content
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Hello World');

    // Select only "Hello" (5 characters from start)
    await page.keyboard.press('Home');
    await page.keyboard.down('Shift');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.up('Shift');

    // Click Bold button
    const toolbar = page.getByRole('toolbar', { name: 'Formatting' });
    const boldBtn = toolbar.getByRole('button', { name: 'Bold' });
    await boldBtn.click();

    // Verify aria-pressed toggled
    await expect(boldBtn).toHaveAttribute('aria-pressed', 'true');

    // Verify "Hello" is wrapped in a bold formatting element (Lexical uses <strong> with CSS class)
    const boldElement = editor.locator('strong.writer-text-bold, b.writer-text-bold, strong, b').filter({ hasText: 'Hello' });
    await expect(boldElement).toHaveText('Hello');

    // Verify "World" is NOT inside any bold element
    const worldBoldAncestor = editor.locator('strong.writer-text-bold, b.writer-text-bold, strong, b').filter({ hasText: 'World' });
    await expect(worldBoldAncestor).toHaveCount(0);

    // Both fragments present in the editor
    await expect(editor).toContainText('Hello');
    await expect(editor).toContainText('World');

    // Click Bold again to toggle off
    await boldBtn.click();
    await expect(boldBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
