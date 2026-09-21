import { test, expect, type Page } from '@playwright/test';
import { setupApiMocks, resetDatabase } from '../helpers/e2e-setup';

/**
 * Settings acceptance — device-local AI preferences.
 *
 * Seeds from a cloned `.lcpack` share (the same pattern as the selection-action
 * spec), then covers the settings surface itself: the AI section persists the
 * material-inclusion and selection-thread preferences across reload, and the
 * "new chat per selection" preference changes where the next Explain turn
 * lands — a distinct session instead of the newest one.
 */
test.describe('Settings E2E', () => {
  let chatRequests: Array<Record<string, unknown>>;
  let workspaceUrl = '';

  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);
    chatRequests = [];

    await page.route(/\/api\/shares(?:\?.*)?$/, async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'share_e2e_settings',
                format: 'lcpack',
                schemaVersion: 1,
                title: 'Settings E2E Notes',
                description: 'Selectable notes for settings tests.',
                author: 'e2e_bot',
                viewCount: 3,
                downloadCount: 1,
                createdAt: '2026-09-01T00:00:00.000Z',
              },
            ],
            nextCursor: null,
            hasMore: false,
          }),
        });
      }
      return route.fallback();
    });

    await page.route(/\/api\/shares\/share_e2e_settings$/, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'share_e2e_settings',
          format: 'lcpack',
          schemaVersion: 1,
          title: 'Settings E2E Notes',
          description: 'Selectable notes for settings tests.',
          author: 'e2e_bot',
          accessType: 'public',
          package: {
            format: 'lcpack',
            schemaVersion: 1,
            metadata: {
              title: 'Settings E2E Notes',
              description: 'Selectable notes for settings tests.',
              author: 'e2e_bot',
              createdAt: '2026-09-01T00:00:00.000Z',
            },
            materials: [
              {
                id: 'pkg_mat_settings',
                title: 'Settings E2E Notes',
                documentContent:
                  '# Settings E2E Notes\n\nThe sinoatrial node initiates every heartbeat in the cardiac conduction system.\n',
              },
            ],
            questions: [],
            quizzes: [],
          },
          viewCount: 4,
          downloadCount: 1,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        }),
      });
    });

    await page.route(/\/api\/shares\/share_e2e_settings\/download$/, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, downloadCount: 2 }),
      });
    });

    await page.route(/\/api\/ai\/chat/, async (route) => {
      chatRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        body: [
          'data: {"type":"start","messageId":"msg-settings-1"}\n\n',
          'data: {"type":"token","text":"Mocked explanation: the sinoatrial node is the heart\'s natural pacemaker."}\n\n',
          'data: {"type":"done"}\n\n',
        ].join(''),
      });
    });

    await page.goto('/explore');
    await expect(page.getByText('Settings E2E Notes')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Clone Settings E2E Notes/i }).click();
    await expect(page.getByText(/In My Library/i).first()).toBeVisible({ timeout: 5000 });
    await page
      .getByRole('button', { name: /Open Settings E2E Notes in your library/i })
      .click();
    await expect(page).toHaveURL(/\/materials\/[^/?]+\?tab=read/);
    workspaceUrl = page.url();
  });

  async function openSettings(page: Page) {
    await page
      .getByRole('navigation', { name: 'Desktop Navigation' })
      .getByRole('button', { name: 'Settings' })
      .click();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({
      timeout: 10000,
    });
  }

  async function selectExcerpt(page: Page) {
    await page.evaluate(() => {
      const paragraph = Array.from(document.querySelectorAll('p')).find((p) =>
        p.textContent?.includes('sinoatrial node initiates every heartbeat'),
      );
      if (!paragraph) throw new Error('selection paragraph not found');
      const textNode = Array.from(paragraph.childNodes).find(
        (n): n is Text => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').includes('sinoatrial'),
      );
      if (!textNode?.textContent) throw new Error('selection text node not found');
      const start = textNode.textContent.indexOf('sinoatrial');
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, start + 'sinoatrial node initiates every heartbeat'.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await expect(page.getByRole('toolbar', { name: 'Selection actions' })).toBeVisible({
      timeout: 5000,
    });
  }

  async function threadCount(page: Page): Promise<number> {
    return page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('lunaclair-db');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        return await new Promise<number>((resolve, reject) => {
          const tx = db.transaction(['aiThreads'], 'readonly');
          const req = tx.objectStore('aiThreads').getAll();
          req.onsuccess = () => resolve((req.result as unknown[]).length);
          req.onerror = () => reject(req.error);
        });
      } finally {
        db.close();
      }
    });
  }

  test('persists AI preferences across reload', async ({ page }) => {
    await openSettings(page);
    await expect(
      page.getByRole('heading', { name: 'AI Study Assistant' }),
    ).toBeVisible();

    // Defaults: whole material, latest chat.
    await expect(page.getByRole('radio', { name: 'Whole material' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Latest chat' })).toBeChecked();

    await page.getByRole('radio', { name: 'No material' }).click();
    await expect(page.getByRole('radio', { name: 'No material' })).toBeChecked();
    await page.getByRole('radio', { name: 'New chat' }).click();
    await expect(page.getByRole('radio', { name: 'New chat' })).toBeChecked();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('radio', { name: 'No material' })).toBeChecked({
      timeout: 10000,
    });
    await expect(page.getByRole('radio', { name: 'New chat' })).toBeChecked();
  });

  test('a selection opens a distinct conversation when New chat is preferred', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: 'Settings E2E Notes' }).first(),
    ).toBeVisible({ timeout: 10000 });

    // First Explain continues (and creates) the newest conversation.
    await selectExcerpt(page);
    let chatRequest = page.waitForRequest(/\/api\/ai\/chat/);
    await page.getByRole('button', { name: 'Explain selected text' }).click();
    await chatRequest;
    await expect.poll(() => chatRequests.length, { timeout: 10000 }).toBe(1);
    await expect(page.getByText(/natural pacemaker/)).toBeVisible({ timeout: 10000 });
    await expect.poll(() => threadCount(page), { timeout: 10000 }).toBe(1);

    // Prefer a distinct conversation per selection.
    await openSettings(page);
    await page.getByRole('radio', { name: 'New chat' }).click();
    await expect(page.getByRole('radio', { name: 'New chat' })).toBeChecked();

    // The next Explain lands on a second session carrying no history.
    await page.goto(workspaceUrl);
    await expect(
      page.getByRole('heading', { name: 'Settings E2E Notes' }).first(),
    ).toBeVisible({ timeout: 10000 });
    await selectExcerpt(page);
    chatRequest = page.waitForRequest(/\/api\/ai\/chat/);
    await page.getByRole('button', { name: 'Explain selected text' }).click();
    await chatRequest;
    await expect.poll(() => chatRequests.length, { timeout: 10000 }).toBe(2);
    const second = chatRequests[1] as {
      messages: Array<{ role: string; content: string }>;
    };
    await expect.poll(() => threadCount(page), { timeout: 10000 }).toBe(2);
    expect(second.messages).toHaveLength(1);
    expect(second.messages[0].content).toContain('Please explain the following excerpt');
  });
});
