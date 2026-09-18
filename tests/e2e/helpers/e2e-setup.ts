import { type Page, expect } from '@playwright/test';

/**
 * Locators for the Writer workspace, centralized to avoid CSS selector duplication.
 */
export const locators = {
  /** The visual editor contenteditable region. */
  editor: (page: Page) => page.getByRole('textbox', { name: 'Study Material Editor' }),

  /** The raw markdown textarea. */
  textarea: (page: Page) => page.getByRole('textbox', { name: 'Raw Markdown Content' }),

  /** The Raw Markdown mode toggle button. */
  rawModeBtn: (page: Page) => page.getByRole('button', { name: /Raw Markdown/i }),

  /** The Visual Editor mode toggle button. */
  visualModeBtn: (page: Page) => page.getByRole('button', { name: /Visual Editor/i }),

  /** The Save Changes button. */
  saveBtn: (page: Page) => page.getByRole('button', { name: /Save Changes/i }),

  /** The status badge showing "Saved to Library". */
  savedBadge: (page: Page) => page.getByText(/Saved to Library/i),

  /** The status badge showing "Unsaved changes". */
  unsavedBadge: (page: Page) => page.getByText(/Unsaved changes/i),

  /** The Read tab (renders as a button, not tab role). */
  readTab: (page: Page) => page.getByRole('button', { name: 'Read' }),
} as const;

/**
 * Switches the Writer to Raw Markdown mode and returns the textarea locator.
 * Asserts the textarea is visible before returning.
 */
export async function switchToRawMode(page: Page) {
  const rawBtn = locators.rawModeBtn(page);
  await rawBtn.click();
  const textarea = locators.textarea(page);
  await expect(textarea).toBeVisible();
  return textarea;
}

/**
 * Switches the Writer to Visual Editor mode and returns the editor locator.
 * Asserts the editor is visible before returning.
 */
export async function switchToVisualMode(page: Page) {
  const visualBtn = locators.visualModeBtn(page);
  // Only click if we're in Raw mode (button visible). If already in Visual mode, skip.
  if (await visualBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await visualBtn.click();
  }
  const editor = locators.editor(page);
  await expect(editor).toBeVisible();
  return editor;
}

/**
 * Mocks the Worker API surface the app actually calls, so tests run offline without a
 * remote D1 connection. Only `GET /api/shares` — the Explore hub's feed — is stubbed
 * here, with an empty list; specs that need content route `/api/shares` themselves with
 * a package payload.
 *
 * Retired endpoints are deliberately not mocked: `/api/catalog`, `/api/catalog/materials/:id`,
 * `/api/documents/:id`, and `/api/quiz` no longer exist on the Worker (its routes are `ai`,
 * `health`, `shares`, `sync`). The official catalog and its document/quiz feeds were replaced
 * by `.lcpack` shares, so stubbing them only kept a deleted backend alive in test fixtures.
 */
export async function setupApiMocks(page: Page) {
  await page.route(/\/api\/shares(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ items: [], nextCursor: null, hasMore: false }),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Resets the IndexedDB database and local storage between E2E tests.
 */
export async function resetDatabase(page: Page) {
  try {
    await page.goto('/');
    await page.evaluate(async () => {
      if (window.indexedDB) {
        await new Promise<void>((resolve) => {
          const req = window.indexedDB.deleteDatabase('lunaclair-db');
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
      }
      try {
        localStorage.clear();
        localStorage.setItem('lunaclair.settings.onboarding_done', '1');
      } catch {
        // Ignore
      }
    });
  } catch {
    // Ignore in non-navigated contexts
  }
}

/**
 * Seeds an imported material for the specs written against the retired official-catalog flow.
 *
 * ⚠️ Stale by design: it expects catalog material titles in Explore and clicks "Add
 * {catalog title}", which the shares-only Explore hub does not render — the specs using this
 * helper need re-seeding from a cloned `.lcpack` share before their results mean anything
 * (root AGENTS.md, "E2E suite status"). Kept so those specs keep a single entry point while
 * that re-seed happens.
 */
export async function setupImportedMaterial(page: Page, materialId = 'cell-structure') {
  // Pre-seed onboarding completion in localStorage so tutorial overlay never blocks interactions
  await page.addInitScript(() => {
    try {
      localStorage.setItem('lunaclair.settings.onboarding_done', '1');
    } catch {
      // Ignore in non-storage contexts
    }
  });

  await setupApiMocks(page);

  // Navigate directly to the Explore hub to perform deterministic imports
  await page.goto('/explore');
  await expect(page.getByText('Cell Structure & Function')).toBeVisible({ timeout: 10000 });

  // Import cell-structure if not already in library
  const cellStructureBtn = page.getByRole('button', { name: /Add Cell Structure & Function/i });
  if (await cellStructureBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cellStructureBtn.click();
    await expect(page.getByText(/In My Library/i).first()).toBeVisible({ timeout: 5000 });
  }

  // Also import cellular-respiration if present and not imported
  const cellularRespirationBtn = page.getByRole('button', { name: /Add Cellular Respiration/i });
  if (await cellularRespirationBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cellularRespirationBtn.click();
    await expect(page.getByText(/In My Library/i).nth(1)).toBeVisible({ timeout: 5000 });
  }

  // Go to the material's Write workspace
  await page.goto(`/materials/${materialId}?tab=write`);

  // Wait for loading to finish and editor / status badge to mount
  await expect(locators.savedBadge(page)).toBeVisible({ timeout: 10000 });
}
