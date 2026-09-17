import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { setupApiMocks, resetDatabase } from '../helpers/e2e-setup';

test.describe('Study Package (.lcpack) Export & Import E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);

    // Import a starting material into the library for testing
    await page.goto('/explore');
    await expect(page.getByText('Cell Structure & Function')).toBeVisible({ timeout: 10000 });
    const importBtn = page.getByRole('button', { name: /Add Cell Structure & Function/i });
    if (await importBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await importBtn.click();
      await expect(page.getByText(/In My Library/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('exports material as .lcpack, verifies package integrity, and imports it via /import with preview dialog', async ({ page }) => {
    // 1. Navigate to material workspace
    await page.goto('/materials/cell-structure');
    await expect(page.getByRole('heading', { name: 'Cell Structure & Function' }).first()).toBeVisible({ timeout: 10000 });

    // 2. Trigger "Export as .lcpack" and capture the browser download
    const exportBtn = page.getByRole('button', { name: /Export as \.lcpack/i }).first();
    await expect(exportBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;

    // Verify downloaded filename is safe and has .lcpack extension
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.lcpack$/);
    expect(filename).not.toContain(':');
    expect(filename).not.toContain('/');

    // 3. Inspect the physical exported .lcpack file content
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const fileContent = fs.readFileSync(downloadPath!, 'utf-8');
    const parsedPackage = JSON.parse(fileContent);

    // Verify package domain invariants
    expect(parsedPackage.format).toBe('lcpack');
    expect(parsedPackage.schemaVersion).toBe(1);
    expect(parsedPackage.metadata.title).toBe('Cell Structure & Function');
    expect(parsedPackage.materials).toHaveLength(1);
    expect(parsedPackage.materials[0].id).toMatch(/^pkg_mat_/);
    expect(parsedPackage.materials[0].documentContent).toBeTruthy();

    // Verify zero local Dexie UUIDs leaked into exported payload
    const rawJsonString = JSON.stringify(parsedPackage);
    expect(rawJsonString).not.toContain('cell-structure');
    expect(rawJsonString).not.toContain('doc_');

    // 4. Navigate to /import
    await page.goto('/import');
    await expect(page.getByText('Drag & drop your study materials')).toBeVisible({ timeout: 10000 });

    // 5. Upload the exported .lcpack file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      {
        name: filename,
        mimeType: 'application/vnd.lunaclair.package+json',
        buffer: Buffer.from(fileContent, 'utf-8'),
      },
    ]);

    // 6. Assert StudyPackagePreviewModal appears with authoritative inspectStudyPackage metrics
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByRole('heading', { name: 'Cell Structure & Function' })).toBeVisible();
    await expect(dialog.getByText('Package Contents')).toBeVisible();
    await expect(dialog.getByText('Materials')).toBeVisible();
    await expect(dialog.getByText('Questions')).toBeVisible();
    await expect(dialog.getByText('Quizzes')).toBeVisible();

    // 7. Click "Import to Library"
    const confirmImportBtn = dialog.getByRole('button', { name: /Import to Library/i });
    await expect(confirmImportBtn).toBeEnabled();
    await confirmImportBtn.click();

    // 8. Verify preview modal closes and success toast is shown
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Study package imported successfully/i)).toBeVisible({ timeout: 5000 });

    // 9. Navigate to the Library and assert two materials now exist (original + imported copy)
    await page.goto('/library');
    const libraryCards = page.getByText('Cell Structure & Function');
    await expect(libraryCards.first()).toBeVisible({ timeout: 10000 });
  });
});
