import { test, expect } from '@playwright/test';
import { setupApiMocks, resetDatabase } from '../helpers/e2e-setup';

test.describe('AI Content Generator E2E — Questions & Flashcards', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);

    // Mock the /api/ai/chat endpoint with deterministic SSE streaming responses
    await page.route(/\/api\/ai\/chat/, async (route) => {
      const postData = route.request().postDataJSON() as { messages?: Array<{ role: string; content: string }> };
      const lastUserMsg = postData?.messages?.find((m) => m.role === 'user')?.content || '';

      if (lastUserMsg.includes('flashcards')) {
        // Flashcard generation response
        const flashcardsJson = JSON.stringify([
          {
            front: 'What organelle is known as the powerhouse of the cell?',
            back: 'Mitochondria (generates cellular ATP through oxidative phosphorylation).',
            sourceSection: 'Cell Organelles',
            tags: ['biology', 'organelles'],
          },
          {
            front: 'What is the function of the rough endoplasmic reticulum?',
            back: 'Protein synthesis and initial folding with bound ribosomes.',
            sourceSection: 'Endomembrane System',
            tags: ['biology', 'proteins'],
          },
        ]);

        const sseBody = [
          'data: {"type":"start","messageId":"msg-fc-1"}\n\n',
          `data: {"type":"token","text":${JSON.stringify(flashcardsJson)}}\n\n`,
          'data: {"type":"done"}\n\n',
        ].join('');

        return route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
          body: sseBody,
        });
      }

      // Default question generation response
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

    // Import cell-structure into library
    await page.goto('/available');
    await expect(page.getByText('Cell Structure & Function')).toBeVisible({ timeout: 10000 });
    const importBtn = page.getByRole('button', { name: /Add Cell Structure & Function/i });
    if (await importBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await importBtn.click();
      await expect(page.getByText(/In My Library/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('generates questions with AI and saves them as drafts to Question Bank', async ({ page }) => {
    // Navigate to Manage -> Question Bank tab
    await page.goto('/materials/cell-structure?tab=manage');
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

  test('generates flashcards with AI and integrates into spaced repetition deck', async ({ page }) => {
    // Navigate to Flashcards tab
    await page.goto('/materials/cell-structure?tab=flashcards');
    const generateAiBtn = page.getByRole('button', { name: /Generate.*AI/i });
    await expect(generateAiBtn).toBeVisible({ timeout: 10000 });

    // Open AI Flashcard Generator Dialog
    await generateAiBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('heading', { name: /Generate Flashcards with AI/i })).toBeVisible();

    // Trigger Flashcard generation
    const generateCardsBtn = dialog.getByRole('button', { name: 'Generate Flashcards' });
    await expect(generateCardsBtn).toBeEnabled();
    await generateCardsBtn.click();

    // Review stage should display front/back cards
    await expect(dialog.getByText(/Generated 2 flashcards/i)).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByText('What organelle is known as the powerhouse of the cell?')).toBeVisible();

    // Save cards to deck
    const saveCardsBtn = dialog.getByRole('button', { name: /Add 2 Flashcards to Deck/i });
    await expect(saveCardsBtn).toBeEnabled();
    await saveCardsBtn.click();

    // Success view in dialog -> click Done
    await expect(dialog.getByText(/Flashcards Saved!/i)).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: 'Done' }).click();

    // Dialog closes and deck reflects ready cards
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Start.*Session/i })).toBeVisible({ timeout: 5000 });
  });
});
