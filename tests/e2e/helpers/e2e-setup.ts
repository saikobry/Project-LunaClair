import { type Page, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

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
 * Mocks Cloudflare Worker /api routes in Playwright so tests run reliably
 * offline without needing a remote D1 database connection.
 */
export async function setupApiMocks(page: Page) {
  const catalogDir = path.resolve(process.cwd(), 'content/catalog');
  const materialsDir = path.resolve(process.cwd(), 'content/materials');

  const materials = JSON.parse(fs.readFileSync(path.join(catalogDir, 'materials.json'), 'utf-8'));
  const subjects = JSON.parse(fs.readFileSync(path.join(catalogDir, 'subjects.json'), 'utf-8'));
  const terms = JSON.parse(fs.readFileSync(path.join(catalogDir, 'terms.json'), 'utf-8'));
  const subjectTerms = JSON.parse(fs.readFileSync(path.join(catalogDir, 'subjectTerms.json'), 'utf-8'));

  await page.route(/\/api\/catalog(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ subjects, terms, subjectTerms, materials }),
    });
  });

  await page.route(/\/api\/catalog\/materials\/([^/?]+)/, async (route) => {
    const url = route.request().url();
    const id = url.split('/api/catalog/materials/')[1]?.split('?')[0];
    const material = materials.find((m: { id: string }) => m.id === id);
    if (!material) {
      return route.fulfill({ status: 404, body: JSON.stringify({ error: 'Material not found' }) });
    }
    const subject = subjects.find((s: { id: string }) => s.id === material.subjectId);
    const term = terms.find((t: { id: string }) => t.id === material.termId);
    const subjectTerm = subjectTerms.find(
      (st: { subjectId: string; termId: string }) =>
        st.subjectId === material.subjectId && st.termId === material.termId,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ material, subject, term, subjectTerm }),
    });
  });

  await page.route(/\/api\/documents\/([^/?]+)/, async (route) => {
    const url = route.request().url();
    const id = url.split('/api/documents/')[1]?.split('?')[0];
    const docPath = path.join(materialsDir, id ?? '', 'index.md');
    let content = `# Default Document for ${id}`;
    if (fs.existsSync(docPath)) {
      content = fs.readFileSync(docPath, 'utf-8');
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ id, title: id, content }),
    });
  });

  await page.route(/\/api\/quiz/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ questions: [], quizzes: [] }),
    });
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
 * Shared helper to dismiss first-run onboarding and ensure a catalog material
 * is imported into the local Dexie library before testing.
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

  // Navigate directly to available materials to perform deterministic imports
  await page.goto('/available');
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
