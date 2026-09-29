import { test, expect } from '@playwright/test';
import { setupApiMocks, resetDatabase } from '../helpers/e2e-setup';
import { cloneShareToLibrary, routeShare } from '../helpers/share-seed';
import { cellularRespiration } from '../helpers/fixtures/cellularRespiration';
import {
  describeUnreadableAllowedTypes,
  readAllowedQuestionTypes,
  requestsOnlyType,
  type AiChatRequestBody,
} from '../helpers/ai-prompt';

test.describe('AI Content Generator E2E — Questions & Flashcards', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);

    // Mock the /api/ai/chat endpoint with deterministic SSE streaming responses
    await page.route(/\/api\/ai\/chat/, async (route) => {
      const postData = route.request().postDataJSON() as AiChatRequestBody | null;
      const messages = postData?.messages ?? [];
      const systemPrompt =
        messages.filter((m) => m.role === 'system').pop()?.content ?? '';

      // The requested types are stated in the SYSTEM prompt (the adapter sends `systemPrompt`
      // as a system-role message), on the app's own "- Allowed Question Types:" line. Reading
      // that line — rather than sniffing the schema blocks — is what makes "the user asked for
      // cards" a real, specific request instead of a guess. The read is centralised in
      // `helpers/ai-prompt.ts` so a harmless prompt reword is a helper fix, not a spec fix.
      if (requestsOnlyType(messages, 'fill_in_blank')) {
        // Card generation. A card is a `fill_in_blank` question through the ONE question
        // generator, so the response is a cloze draft: the template carries the `___`
        // marker and `blanks` carries one answer per marker.
        const clozeJson = JSON.stringify([
          {
            type: 'fill_in_blank',
            prompt: 'Fill in the blank with the organelle that generates most cellular ATP.',
            payload: {
              type: 'fill_in_blank',
              template: 'Most ATP is generated in the ___, a double-membraned organelle.',
              blanks: ['mitochondria'],
            },
            difficulty: 'easy',
            points: 1,
            sourceSection: 'Glycolysis',
            tags: ['biology', 'organelles'],
            explanation: 'Glycolysis itself occurs in the cytoplasm.',
          },
        ]);

        const sseBody = [
          'data: {"type":"start","messageId":"msg-cloze-1"}\n\n',
          `data: {"type":"token","text":${JSON.stringify(clozeJson)}}\n\n`,
          'data: {"type":"done"}\n\n',
        ].join('');

        return route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
          body: sseBody,
        });
      }

      // Default question generation response. If the types line could not be read at all,
      // the mock cannot tell a cloze request from a general one, so it says so here — a
      // prompt reword is then reported as a prompt reword rather than as a spec below
      // failing on a draft it never asked for.
      if (readAllowedQuestionTypes(messages).length === 0) {
        console.warn(`[e2e ai-generator] ${describeUnreadableAllowedTypes(systemPrompt)}`);
      }

      const questionsJson = JSON.stringify([
        {
          type: 'multiple_choice',
          prompt: 'What organelle is primarily responsible for synthesizing ATP in eukaryotic cells?',
          payload: {
            type: 'multiple_choice',
            choices: [
              'Mitochondria',
              'Golgi apparatus',
              'Endoplasmic reticulum',
              'Lysosome',
            ],
            correctIndex: 0,
          },
          difficulty: 'easy',
          points: 1,
          explanation: 'Mitochondria generate cellular energy in the form of ATP through oxidative phosphorylation.',
          sourceSection: 'Cell Organelles',
          tags: ['biology', 'organelles'],
        },
      ]);

      const sseBody = [
        'data: {"type":"start","messageId":"msg-q-1"}\n\n',
        `data: {"type":"token","text":${JSON.stringify(questionsJson)}}\n\n`,
        'data: {"type":"done"}\n\n',
      ].join('');

      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        body: sseBody,
      });
    });

    await routeShare(page, cellularRespiration);  });

  test('generates questions with AI and saves them as drafts to Question Bank', async ({ page }) => {
    await cloneShareToLibrary(page, cellularRespiration, 'questions');
    await expect(page.getByRole('button', { name: /Generate with AI/i })).toBeVisible({ timeout: 10000 });

    // Open AI Generator Dialog
    await page.getByRole('button', { name: /Generate with AI/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('heading', { name: /Generate Questions with AI/i })).toBeVisible();

    // Verify initial configuration screen
    await expect(dialog.getByText(/Number of Questions/i)).toBeVisible();
    const generateBtn = dialog.getByRole('button', { name: 'Generate Questions' });
    await expect(generateBtn).toBeEnabled();

    // Trigger AI generation
    await generateBtn.click();

    // Review stage should display the preview card with generated content
    await expect(dialog.getByText(/Generated 1 questions/i)).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByText('What organelle is primarily responsible for synthesizing ATP in eukaryotic cells?')).toBeVisible();

    // Click "Add 1 Questions to Bank"
    const saveToBankBtn = dialog.getByRole('button', { name: /Add 1 Questions to Bank/i });
    await expect(saveToBankBtn).toBeEnabled();
    await saveToBankBtn.click();

    // Success view in dialog -> click Done
    await expect(dialog.getByText(/Questions Saved!/i)).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: 'Done' }).click();

    // Dialog closes and question appears in Question Bank with DRAFT badge
    await expect(dialog).not.toBeVisible();
    const questionCard = page.getByText('What organelle is primarily responsible for synthesizing ATP in eukaryotic cells?');
    await expect(questionCard).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('draft', { exact: true })).toBeVisible();
  });

  test('hands an empty flashcard deck to the cloze generator and offers a way back', async ({ page }) => {
    // The Flashcards tab still authors nothing: it hands off to the Question Bank, which owns
    // the single generator. This walks the whole path the retired dialog used to own — and the
    // return leg the handoff used to be missing.
    await cloneShareToLibrary(page, cellularRespiration, 'flashcards');

    // The empty deck names the real relationship and offers exactly one way forward.
    await expect(
      page.getByRole('heading', { name: 'No Flashcards Available' }),
    ).toBeVisible({ timeout: 10000 });
    const generateQuestionsBtn = page.getByRole('button', { name: 'Generate questions' });
    await expect(generateQuestionsBtn).toBeVisible();

    // The handoff lands on the Question Bank. The workspace still routes by `?tab=` only —
    // there is deliberately no URL state for "the generator dialog is open", because a
    // transient dialog is not a route and a link could not restore it. What the launch adds is
    // the dialog itself, opened with Fill in the Blank already selected.
    await generateQuestionsBtn.click();
    await expect(page).toHaveURL(/\/materials\/[^/?]+\?tab=questions(?:&|$)/);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Generate Questions with AI/i })).toBeVisible();

    // The launch intent preselected the cloze and nothing else, so the request carries only
    // the `fill_in_blank` schema — which is what the route mock keys its card response off.
    // The type control is the assertion: the other four pills read as unselected.
    const clozePill = dialog.getByRole('button', { name: 'Fill in the Blank', exact: true });
    await expect(clozePill).toHaveClass(/pillActive/);
    await expect(dialog.getByRole('button', { name: 'Multiple Choice', exact: true })).not.toHaveClass(
      /pillActive/,
    );

    const generateBtn = dialog.getByRole('button', { name: 'Generate Questions' });
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // The review step shows a real cloze draft — the `___` marker in its template and the
    // answer behind it, not a flattened front/back pair.
    await expect(dialog.getByText(/Generated 1 questions/i)).toBeVisible({ timeout: 10000 });
    await expect(
      dialog.getByText('Most ATP is generated in the ___, a double-membraned organelle.'),
    ).toBeVisible();
    await expect(dialog.getByText('Blanks:', { exact: false })).toBeVisible();
    await expect(dialog.getByText(/mitochondria/)).toBeVisible();
    // The type badge is the domain's own label, read off the persisted `type`.
    await expect(dialog.getByText('Fill in the Blank', { exact: true })).toBeVisible();

    const saveBtn = dialog.getByRole('button', { name: /Add 1 Questions to Bank/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    await expect(dialog.getByText(/Questions Saved!/i)).toBeVisible({ timeout: 5000 });

    // The return leg: the dialog's done step offers a way back to Study, so the user is not
    // left to rediscover the two-tier switch by hand.
    const studyTheseBtn = dialog.getByRole('button', { name: 'Study these questions' });
    await expect(studyTheseBtn).toBeVisible();
    await studyTheseBtn.click();

    // It returns to the Flashcards tab for THIS material, in the Study tier.
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/materials\/[^/?]+\?tab=flashcards(?:&|$)/);
    await expect(
      page.getByRole('heading', { name: 'Flashcards & Spaced Repetition' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Start Flashcard Session' })).toBeEnabled();
    // The card came from the cloze: its single blank projects exactly one card, and the
    // setup view counts CARDS (not questions) — which is the whole point of typing it.
    await expect(page.getByText('1 Total in Bank')).toBeVisible();

    // And the intent is one-shot: returning to the Bank must not re-open the dialog.
    // (The per-mode tab strip renders as buttons; only the Study/Manage switch is a tablist.)
    await page.getByRole('tab', { name: 'Manage' }).click();
    await expect(page).toHaveURL(/\/materials\/[^/?]+\?tab=questions(?:&|$)/);
    await expect(page.getByRole('button', { name: 'Question Bank' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The saved row really is a typed Fill in the Blank draft — not an "Identification"
    // card, and not hardcoded to medium difficulty.
    const questionCard = page.getByText(
      'Fill in the blank with the organelle that generates most cellular ATP.',
    );
    await expect(questionCard).toBeVisible({ timeout: 5000 });
    // Scope to the one bank card. `exact` matters here: `getByText` matches a
    // case-insensitive SUBSTRING by default, so 'Fill in the Blank' would also hit the
    // prompt paragraph that opens with the same words.
    const card = questionCard.locator('xpath=ancestor::*[contains(@class,"card")][1]');
    await expect(card.getByText('Fill in the Blank', { exact: true })).toBeVisible();
    await expect(card.getByText('draft', { exact: true })).toBeVisible();
  });
});
