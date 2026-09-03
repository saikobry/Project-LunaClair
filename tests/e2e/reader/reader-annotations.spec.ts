import { test, expect } from '@playwright/test';
import { setupImportedMaterial, resetDatabase } from '../helpers/e2e-setup';

test.describe('Reader Document Annotations & Freehand Drawings E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupImportedMaterial(page, 'cell-structure');
  });

  test('renders markdown document, supports freehand drawing with undo, and persists drawn annotations across reload', async ({
    page,
  }) => {
    // 1. Switch to Read workspace tab
    const readTab = page.getByRole('button', { name: 'Read' });
    await expect(readTab).toBeVisible();
    await readTab.click();

    // 2. High-fidelity Markdown viewer renders document content
    await expect(
      page.getByRole('heading', { name: 'Cell Structure & Function' }).first(),
    ).toBeVisible({ timeout: 10000 });

    // 3. Open annotation floating toolbar
    const openAnnotationsBtn = page.getByRole('button', {
      name: 'Open Annotations',
    });
    await expect(openAnnotationsBtn).toBeVisible();
    await openAnnotationsBtn.click();

    // 4. Switch to Draw on Page mode
    const drawModeBtn = page.getByRole('button', { name: 'Draw on Page' });
    await expect(drawModeBtn).toBeVisible();
    await drawModeBtn.click();

    // Undo button should initially be disabled since no strokes exist
    const undoBtn = page.getByRole('button', { name: 'Undo Last Stroke' });
    await expect(undoBtn).toBeVisible();
    await expect(undoBtn).toBeDisabled();

    // 5. Draw a stroke on the drawing canvas
    const canvas = page.getByLabel('Drawing Canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + 120);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 60, box.y + 180);
      await page.mouse.up();
    }

    // 6. Undo button becomes enabled after drawing a stroke
    await expect(undoBtn).toBeEnabled({ timeout: 5000 });

    // 7. Click Undo to revert the stroke
    await undoBtn.click();
    await expect(undoBtn).toBeDisabled({ timeout: 5000 });

    // 8. Draw another stroke to persist
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + 150);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 80, box.y + 200);
      await page.mouse.up();
    }
    await expect(undoBtn).toBeEnabled({ timeout: 5000 });

    // 9. Reload the page to verify drawing persistence via Dexie
    await page.reload();

    // Switch back to Read tab
    const readTabAfterReload = page.getByRole('button', { name: 'Read' });
    await expect(readTabAfterReload).toBeVisible();
    await readTabAfterReload.click();

    await expect(
      page.getByRole('heading', { name: 'Cell Structure & Function' }).first(),
    ).toBeVisible({ timeout: 10000 });

    // Open annotations toolbar and enter draw mode to inspect state
    const openAnnotationsAfterReload = page.getByRole('button', {
      name: 'Open Annotations',
    });
    await expect(openAnnotationsAfterReload).toBeVisible();
    await openAnnotationsAfterReload.click();

    const drawModeAfterReload = page.getByRole('button', { name: 'Draw on Page' });
    await expect(drawModeAfterReload).toBeVisible();
    await drawModeAfterReload.click();

    // 10. Undo button remains enabled, proving the drawn path was persisted in Dexie
    const undoBtnAfterReload = page.getByRole('button', { name: 'Undo Last Stroke' });
    await expect(undoBtnAfterReload).toBeVisible();
    await expect(undoBtnAfterReload).toBeEnabled({ timeout: 5000 });
  });
});
