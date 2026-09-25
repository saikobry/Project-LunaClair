import { test, expect, type Page } from '@playwright/test';
import { setupApiMocks, resetDatabase } from '../helpers/e2e-setup';
import { cloneShareToLibrary, routeShare, type ShareFixture } from '../helpers/share-seed';

const selectionShare: ShareFixture = {
  shareId: 'share_e2e_ai_sel',
  title: 'AI Selection E2E Notes',
  description: 'Selectable notes for selection-action tests.',
  author: 'e2e_bot',
  createdAt: '2026-09-01T00:00:00.000Z',
  viewCount: 3,
  downloadCount: 1,
  package: {
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
      title: 'AI Selection E2E Notes',
      description: 'Selectable notes for selection-action tests.',
      author: 'e2e_bot',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    materials: [
      {
        id: 'pkg_mat_ai_sel',
        title: 'AI Selection E2E Notes',
        documentContent:
          '# AI Selection E2E Notes\n\nThe sinoatrial node initiates every heartbeat in the cardiac conduction system.\n',
      },
    ],
    questions: [],
    quizzes: [],
  },
};

/**
 * Reader selection → AI chat acceptance.
 *
 * Regression cover for the selector actions (Explain / Simplify / Example)
 * silently dropping the turn: the rail must produce a real
 * `POST /api/ai/chat` carrying the prompt preset + excerpt, and the answer
 * must land visibly in the drawer's transcript. A run that creates (or
 * reopens) a session without ever issuing the request fails here instead of
 * failing silently in the app.
 */
test.describe('Reader Selection AI Actions E2E', () => {
  // Captured chat payloads per test, in request order.
  let chatRequests: Array<Record<string, unknown>>;

  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);
    chatRequests = [];

    await routeShare(page, selectionShare);
    await cloneShareToLibrary(page, selectionShare, 'read');

    // Chat endpoint: record the payload, answer with deterministic SSE.
    await page.route(/\/api\/ai\/chat/, async (route) => {
      chatRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      const sseBody = [
        'data: {"type":"start","messageId":"msg-sel-1"}\n\n',
        'data: {"type":"token","text":"Mocked explanation: the sinoatrial node is the heart\'s natural pacemaker."}\n\n',
        'data: {"type":"done"}\n\n',
      ].join('');
      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        body: sseBody,
      });
    });

  });

  /**
   * Raises a real text selection over the sinoatrial sentence and notifies the
   * reader's `selectionchange` listener, which is what opens the rail.
   * (Programmatic rather than mouse-driven: only the browser's
   * click-to-selection mechanics are bypassed, not the app path under test.)
   */
  async function selectParagraph(target: Page) {
    await target.evaluate(() => {
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
    await expect(target.getByRole('toolbar', { name: 'Selection actions' })).toBeVisible({
      timeout: 5000,
    });
  }

  test('Explain sends a grounded chat turn and renders the answer', async ({ page }) => {
    await selectParagraph(page);

    const chatRequest = page.waitForRequest(/\/api\/ai\/chat/);
    await page.getByRole('button', { name: 'Explain selected text' }).click();
    await chatRequest;

    // The route handler records the payload asynchronously after the request
    // is issued, so poll for it rather than asserting synchronously.
    await expect.poll(() => chatRequests.length, { timeout: 10000 }).toBe(1);
    const body = chatRequests[0] as {
      messages: Array<{ role: string; content: string }>;
      selection?: { text: string };
      documentContext?: { markdown: string };
    };
    const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
    expect(lastUser?.content).toContain('Please explain the following excerpt');
    expect(lastUser?.content).toContain('sinoatrial node');
    expect(body.selection?.text).toContain('sinoatrial node');
    expect(body.documentContext?.markdown).toContain('sinoatrial node');

    // The turn is visible in the drawer transcript: prompt preset + streamed answer.
    await expect(page.getByText(/Please explain the following excerpt/)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/natural pacemaker/)).toBeVisible({ timeout: 10000 });
  });

  test('Simplify sends its own prompt preset as a distinct turn', async ({ page }) => {
    await selectParagraph(page);

    const chatRequest = page.waitForRequest(/\/api\/ai\/chat/);
    await page.getByRole('button', { name: 'Simplify selected text' }).click();
    await chatRequest;

    await expect.poll(() => chatRequests.length, { timeout: 10000 }).toBe(1);
    const body = chatRequests[0] as {
      messages: Array<{ role: string; content: string }>;
      selection?: { text: string };
    };
    const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
    expect(lastUser?.content).toContain('Please simplify this concept');
    expect(lastUser?.content).toContain('sinoatrial node');
    expect(body.selection?.text).toContain('sinoatrial node');

    await expect(page.getByText(/Please simplify this concept/)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/natural pacemaker/)).toBeVisible({ timeout: 10000 });
  });
});
