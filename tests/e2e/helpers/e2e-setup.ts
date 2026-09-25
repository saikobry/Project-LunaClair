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
 * Switches from either workspace mode to the Study tier and opens Read.
 * The workspace uses Study/Manage mode tabs, while the per-mode content tabs
 * render Read as a button.
 */
export async function switchToReadMode(page: Page): Promise<void> {
  const studyMode = page.getByRole('tab', { name: 'Study' });
  await expect(studyMode).toBeVisible();
  if ((await studyMode.getAttribute('aria-selected')) !== 'true') {
    await studyMode.click();
  }

  const readTab = locators.readTab(page);
  await expect(readTab).toBeVisible();
  await readTab.click();
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
