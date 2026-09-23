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

  test('shows the 5-step wizard drop zone at /import', async ({ page }) => {
    await page.goto('/import');

    // Verify URL and wizard drop zone
    await expect(page).toHaveURL('/import');
    await expect(page.getByText('Drag & drop your study materials')).toBeVisible();
    await expect(page.getByText('PDF, PNG, JPG, JPEG, JFIF, WEBP')).toBeVisible();
  });

  test('reaches /import from the fresh-install Home empty state', async ({ page }) => {
    await page.goto('/');

    // With an empty library the dashboard is replaced by the first-run state,
    // which must still keep Import reachable now that it has no nav slot.
    const importAction = page.getByRole('button', { name: 'Import a PDF' });
    await expect(importAction).toBeVisible({ timeout: 10000 });
    await importAction.click();

    await expect(page).toHaveURL('/import');
    await expect(page.getByText('Drag & drop your study materials')).toBeVisible();
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
    const aiToggleBtn = page.getByRole('button', { name: /AI Cleanup/i });
    await expect(aiToggleBtn).toBeVisible();

    // Open AI Cleanup accordion panel and trigger cleanup
    await aiToggleBtn.click();
    const runBtn = page.getByRole('button', { name: /Run AI Cleanup/i });
    await expect(runBtn).toBeVisible();
    await runBtn.click();

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

  test('switches the reviewed file from the toolbar file selector', async ({ page }) => {
    await page.goto('/import');

    // Real-browser check for the Option B selector: the popover is absolutely
    // positioned inside the step body's scroll container, so this is where
    // clipping or stacking problems would actually show up.
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      { name: 'notes-page-1.png', mimeType: 'image/png', buffer: pngBuffer },
      { name: 'notes-page-2.png', mimeType: 'image/png', buffer: pngBuffer },
    ]);

    await expect(page.getByText('notes-page-1.png')).toBeVisible();
    await expect(page.getByText('notes-page-2.png')).toBeVisible();

    await page.getByRole('button', { name: /Start Extraction/i }).click();
    await expect(page.getByText('Step 3 of 5: Review Content')).toBeVisible({ timeout: 30000 });

    // The permanent Files sidebar is gone; the toolbar trigger replaces it.
    await expect(page.getByRole('heading', { name: 'Files' })).toHaveCount(0);
    const trigger = page.getByRole('button', { name: /\(1 of 2\)/ });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const listbox = page.getByRole('listbox', { name: 'Select file to review' });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option')).toHaveCount(2);

    await page.getByRole('option', { name: /notes-page-2\.png/ }).click();

    await expect(listbox).not.toBeVisible();
    await expect(page.getByRole('button', { name: /\(2 of 2\)/ })).toBeVisible();
  });

  test('extracts scanned PDF with AI Vision when selected', async ({ page }) => {
    let aiChatCalled = false;

    await page.route(/\/api\/ai\/chat/, async (route) => {
      aiChatCalled = true;
      const visionMarkdown = `# University Transcript\n\n| Course | Grade |\n|---|---|\n| Math 101 | 1.25 |`;
      const sseBody = [
        'data: {"type":"start","messageId":"msg-vision-1"}\n\n',
        `data: {"type":"token","text":${JSON.stringify(visionMarkdown)}}\n\n`,
        'data: {"type":"done","usage":{"promptTokens":800,"completionTokens":50}}\n\n',
      ].join('');

      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        body: sseBody,
      });
    });

    await page.goto('/import');

    // Upload PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('C:/Users/B/Downloads/Bryan_James_Dalanon_TOR.pdf');

    // Verify file card appears
    await expect(page.getByText('Bryan_James_Dalanon_TOR.pdf')).toBeVisible();

    // Select AI Vision radio button (now visible since a file is staged)
    const aiVisionRadio = page.getByRole('radio', { name: /AI Vision/i });
    await expect(aiVisionRadio).toBeVisible();
    await aiVisionRadio.check();
    await expect(aiVisionRadio).toBeChecked();

    // Click Start Extraction
    const extractBtn = page.getByRole('button', { name: /Start Extraction/i });
    await expect(extractBtn).toBeVisible();
    await extractBtn.click();

    // Wait for Review step
    await expect(page.getByText('Step 3 of 5: Review Content')).toBeVisible({ timeout: 30000 });

    expect(aiChatCalled).toBe(true);
  });
});
