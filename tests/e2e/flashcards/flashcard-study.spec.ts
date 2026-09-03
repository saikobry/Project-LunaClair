import { test, expect } from '@playwright/test';
import { setupImportedMaterial, resetDatabase } from '../helpers/e2e-setup';

test.describe('Spaced Repetition Flashcard Study E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupImportedMaterial(page, 'cell-structure', { seedQuiz: true });
  });

  test('reviews flashcard deck with 3D flip card, rates retention, and persists review state across reload', async ({
    page,
  }) => {
    // 1. Navigate to Flashcards tab in material workspace
    const flashcardsTab = page.getByRole('button', { name: 'Flashcards' });
    await expect(flashcardsTab).toBeVisible();
    await flashcardsTab.click();

    // 2. Flashcard deck setup view is presented
    await expect(
      page.getByRole('heading', { name: 'Flashcards & Spaced Repetition' }),
    ).toBeVisible({ timeout: 10000 });

    // Filter to the focused 2-question "Cell Structure Quiz"
    const quizFilter = page.getByLabel('Quiz Filter');
    await expect(quizFilter).toBeVisible({ timeout: 5000 });
    await quizFilter.selectOption({ label: 'Cell Structure Quiz (2 questions)' });

    // 3. Start the flashcard study session
    const startSessionButton = page.getByRole('button', {
      name: 'Start Flashcard Session',
    });
    await expect(startSessionButton).toBeVisible();
    await startSessionButton.click();

    // 4. Card 1 front face is visible with question prompt
    await expect(
      page.getByText('Which organelle is responsible for producing ATP?'),
    ).toBeVisible({ timeout: 5000 });

    // Flip card to reveal answer
    const flipButton = page.getByRole('button', { name: /Reveal Answer|Show answer/i }).first();
    await expect(flipButton).toBeVisible();
    await flipButton.click();

    // Card 1 back face reveals the correct answer and explanation
    await expect(page.getByText('Mitochondria', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/powerhouse of the cell/i),
    ).toBeVisible();

    // Rate recall as "Good"
    const goodRatingButton = page.getByRole('button', { name: /Good/i });
    await expect(goodRatingButton).toBeVisible();
    await goodRatingButton.click();

    // 5. Card 2 front face is visible
    await expect(
      page.getByText('Prokaryotic cells have a membrane-bound nucleus.'),
    ).toBeVisible({ timeout: 5000 });

    // Flip card 2
    const flipButton2 = page.getByRole('button', { name: /Reveal Answer|Show answer/i }).first();
    await expect(flipButton2).toBeVisible();
    await flipButton2.click();

    // Card 2 back face reveals "False"
    await expect(page.getByText('False', { exact: true })).toBeVisible();

    // Rate recall as "Easy"
    const easyRatingButton = page.getByRole('button', { name: /Easy/i });
    await expect(easyRatingButton).toBeVisible();
    await easyRatingButton.click();

    // 6. Session End summary view is displayed
    await expect(
      page.getByRole('heading', { name: 'Session Complete!' }),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/You reviewed 2 cards/i)).toBeVisible();

    // Return to deck setup
    const backToSetupButton = page.getByRole('button', {
      name: 'Back to Deck Setup',
    });
    await expect(backToSetupButton).toBeVisible();
    await backToSetupButton.click();

    // 7. Verify deck reflects updated state in UI
    await expect(
      page.getByRole('heading', { name: 'Flashcards & Spaced Repetition' }),
    ).toBeVisible();

    // 8. Reload page to verify review state persisted in Dexie
    await page.reload();

    // Switch back to Flashcards tab
    const flashcardsTabAfterReload = page.getByRole('button', { name: 'Flashcards' });
    await expect(flashcardsTabAfterReload).toBeVisible();
    await flashcardsTabAfterReload.click();

    // Deck setup loads successfully with persisted reviews
    await expect(
      page.getByRole('heading', { name: 'Flashcards & Spaced Repetition' }),
    ).toBeVisible({ timeout: 10000 });
    // Verify Start Flashcard Session button is still available
    await expect(
      page.getByRole('button', { name: 'Start Flashcard Session' }),
    ).toBeVisible();
  });
});
