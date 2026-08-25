import { test, expect } from '@playwright/test';
import { setupApiMocks, resetDatabase } from '../helpers/e2e-setup';

test.describe('Content Importer & AI Cleanup E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);

    // Mock the /api/ai/chat endpoint for AI Cleanup
    await page.route(/\/api\/ai\/chat/, async (route) => {
      const cleanedMarkdown = `# Biology Lecture Notes\n\n## Cellular Respiration\n\nCellular respiration converts glucose into ATP.\n\n- Glycolysis\n- Krebs Cycle\n- Electron Transport Chain`;

      const sseBody = [
        'data: {"type":"start","messageId":"msg-cleanup-1"}\n\n',
        `data: {"type":"token","text":${JSON.stringify(cleanedMarkdown)}}\n\n`,
        'data: {"type":"done"}\n\n',
      ].join('');

      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        body: sseBody,
      });
    });
  });

  test('navigates to /import and shows the 5-step wizard drop zone', async ({ page }) => {
    await page.goto('/');
    
    // Click "Import" in sidebar
    const importNavLink = page.getByRole('button', { name: 'Import' });
    await expect(importNavLink).toBeVisible({ timeout: 10000 });
    await importNavLink.click();

    // Verify URL and wizard drop zone
    await expect(page).toHaveURL('/import');
    await expect(page.getByText('Drag & drop your study materials')).toBeVisible();
    await expect(page.getByText('PDF, PNG, JPG, JPEG, JFIF, WEBP')).toBeVisible();
  });

  test('runs AI cleanup in review step and accepts cleaned diff', async ({ page }) => {
    await page.goto('/import');

    // Create a mock image file payload
    const filePayload = {
      name: 'biology-notes.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      ),
    };

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([filePayload]);

    // File card should appear in selecting step
    await expect(page.getByText('biology-notes.png')).toBeVisible();

    // Start extraction
    const extractBtn = page.getByRole('button', { name: /Start Extraction/i });
    await expect(extractBtn).toBeVisible();
    await extractBtn.click();

    // After extraction completes, wizard transitions to Review step
    await expect(page.getByText('Step 3 of 5: Review Content')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /AI Cleanup/i })).toBeVisible();

    // Trigger AI Cleanup
    await page.getByRole('button', { name: /AI Cleanup/i }).click();

    // Diff modal should open with Original and AI Cleaned columns
    await expect(page.getByText('AI Cleanup Diff Comparison')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Original Extracted Text')).toBeVisible();
    await expect(page.getByText('AI Cleaned Structure')).toBeVisible();
    await expect(page.getByText('Cellular respiration converts glucose into ATP.')).toBeVisible();

    // Accept AI Cleaned
    const acceptBtn = page.getByRole('button', { name: 'Accept AI Cleaned' });
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Diff modal closes and editor contains the cleaned text
    await expect(page.getByText('AI Cleanup Diff Comparison')).not.toBeVisible();

    // Move to Step 4: Material Details
    const nextBtn = page.getByRole('button', { name: /Next: Material Details/i });
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Verify Details step
    await expect(page.getByText('Step 4 of 5: Material Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Material Details' })).toBeVisible();

    // Commit import to library
    const commitBtn = page.getByRole('button', { name: /Save to Library/i });
    await expect(commitBtn).toBeVisible();
    await commitBtn.click();

    // Verify Step 5: Completed
    await expect(page.getByText('Step 5 of 5: Completed')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Import Successful')).toBeVisible();
    const openMaterialBtn = page.getByRole('button', { name: 'Open Material' });
    await expect(openMaterialBtn).toBeVisible();

    // Click Open Material and verify navigation to the material workspace
    await openMaterialBtn.click();
    await expect(page).toHaveURL(/\/materials\/[a-zA-Z0-9-]+\?tab=read/);
    await expect(page.getByText('Cellular respiration converts glucose into ATP.')).toBeVisible({ timeout: 10000 });
  });
});
