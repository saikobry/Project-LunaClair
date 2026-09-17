import { test, expect } from '@playwright/test';
import { setupApiMocks, resetDatabase } from '../helpers/e2e-setup';

test.describe('Study Package Cloud Sharing & 1-Click Clone E2E', () => {
  let inMemoryShares: Map<string, any>;

  test.beforeEach(async ({ page }) => {
    inMemoryShares = new Map();
    await resetDatabase(page);
    await setupApiMocks(page);

    // Mock Cloudflare Worker /api/shares endpoints
    await page.route(/\/api\/shares$/, async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const shareId = 'share_mock_123';
        const shareData = {
          id: shareId,
          format: 'lcpack',
          schemaVersion: 1,
          title: body.package.metadata.title,
          description: body.package.metadata.description,
          author: body.package.metadata.author,
          accessType: body.accessType || 'public',
          passcode: body.passcode,
          package: body.package,
          viewCount: 0,
          downloadCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        inMemoryShares.set(shareId, shareData);

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: shareId,
            format: 'lcpack',
            schemaVersion: 1,
            title: shareData.title,
            accessType: shareData.accessType,
            shareUrl: `/share/${shareId}`,
            createdAt: shareData.createdAt,
          }),
        });
      }
      return route.fallback();
    });

    await page.route(/\/api\/shares\/([^/?]+)\/download$/, async (route) => {
      const url = route.request().url();
      const idMatch = url.match(/\/api\/shares\/([^/?]+)\/download/);
      const shareId = idMatch ? idMatch[1] : '';
      const share = inMemoryShares.get(shareId);
      if (share) {
        share.downloadCount += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, downloadCount: share.downloadCount }),
        });
      }
      return route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
    });

    await page.route(/\/api\/shares\/([^/?]+)$/, async (route) => {
      if (route.request().method() === 'GET') {
        const url = route.request().url();
        const idMatch = url.match(/\/api\/shares\/([^/?]+)$/);
        const shareId = idMatch ? idMatch[1] : '';
        const share = inMemoryShares.get(shareId);

        if (!share) {
          return route.fulfill({ status: 404, body: JSON.stringify({ error: 'Share not found' }) });
        }

        // Passcode verification
        if (share.accessType === 'passcode') {
          const sentPasscode = route.request().headers()['x-share-passcode'];
          if (!sentPasscode || sentPasscode !== share.passcode) {
            return route.fulfill({
              status: 401,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Passcode required' }),
            });
          }
        }

        share.viewCount += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: share.id,
            format: share.format,
            schemaVersion: share.schemaVersion,
            title: share.title,
            description: share.description,
            author: share.author,
            accessType: share.accessType,
            package: share.package,
            viewCount: share.viewCount,
            downloadCount: share.downloadCount,
            createdAt: share.createdAt,
            updatedAt: share.updatedAt,
          }),
        });
      }
      return route.fallback();
    });

    // Import starting material
    await page.goto('/explore');
    await expect(page.getByText('Cell Structure & Function')).toBeVisible({ timeout: 10000 });
    const importBtn = page.getByRole('button', { name: /Add Cell Structure & Function/i });
    if (await importBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await importBtn.click();
      await expect(page.getByText(/In My Library/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('publishes passcode-protected share, unlocks via /share/:id, downloads .lcpack, and 1-click clones to local library', async ({ page }) => {
    // 1. Navigate to material workspace
    await page.goto('/materials/cell-structure');
    await expect(page.getByRole('heading', { name: 'Cell Structure & Function' }).first()).toBeVisible({ timeout: 10000 });

    // 2. Open Share modal
    const shareBtn = page.getByRole('button', { name: /Share/i }).first();
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // 3. Configure passcode protection in ShareStudyPackageModal
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByRole('heading', { name: 'Share Study Package' })).toBeVisible();

    // Select Passcode Protected
    const passcodeRadio = modal.getByRole('radio', { name: /Passcode/i });
    await passcodeRadio.click();

    // Enter Passcode
    const passcodeInput = modal.getByPlaceholder(/Enter access passcode/i);
    await expect(passcodeInput).toBeVisible();
    await passcodeInput.fill('biology2026');

    // Click Publish
    const publishBtn = modal.getByRole('button', { name: /Publish to Cloud/i });
    await publishBtn.click();

    // 4. Verify publish success state & share links
    await expect(modal.getByText(/Package Published!/i)).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText(/share_mock_123/)).toBeVisible();

    // Close modal
    const doneBtn = modal.getByRole('button', { name: /Done/i });
    await doneBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // 5. Navigate to short link /s/share_mock_123
    await page.goto('/s/share_mock_123');

    // 6. Assert Passcode Required screen renders
    await expect(page.getByRole('heading', { name: 'Passcode Protected' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/This study package is passcode protected/i)).toBeVisible();

    // 7. Try wrong passcode
    const unlockInput = page.getByPlaceholder(/Enter passcode/i);
    await unlockInput.fill('wrongpassword');
    const unlockBtn = page.getByRole('button', { name: /Unlock Package/i });
    await unlockBtn.click();
    await expect(page.getByText(/Incorrect passcode/i)).toBeVisible({ timeout: 5000 });

    // 8. Enter correct passcode and unlock
    await unlockInput.fill('biology2026');
    await unlockBtn.click();

    // 9. Assert SharedPackageScreen renders package preview with inspectStudyPackage metrics
    await expect(page.getByRole('heading', { name: 'Cell Structure & Function' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Package Contents/i)).toBeVisible();
    await expect(page.getByText('Materials').first()).toBeVisible();

    // 10. Test "Download .lcpack" action
    const downloadPromise = page.waitForEvent('download');
    const downloadLcpackBtn = page.getByRole('button', { name: /Download \.lcpack/i });
    await downloadLcpackBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.lcpack$/);

    // 11. Test "Clone to Library" action
    const cloneBtn = page.getByRole('button', { name: /Clone to Library/i });
    await cloneBtn.click();

    // Verify success banner appears
    await expect(page.getByText(/Study package successfully cloned to your library!/i)).toBeVisible({ timeout: 5000 });
    const openClonedBtn = page.getByRole('button', { name: /Open Cloned Material/i });
    await expect(openClonedBtn).toBeVisible();

    // 12. Open Cloned Material and verify in workspace
    await openClonedBtn.click();
    await expect(page.getByRole('heading', { name: 'Cell Structure & Function' }).first()).toBeVisible({ timeout: 10000 });
  });
});
