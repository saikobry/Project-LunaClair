import { test, expect, type Page, type Locator } from '@playwright/test';
import { resetDatabase, setupApiMocks } from '../helpers/e2e-setup';
import { cloneShareToLibrary, routeShare } from '../helpers/share-seed';
import { cellStructure } from '../helpers/fixtures/cellStructure';

const QUIZ_FILTER_LABEL_INITIAL = 'Cell Structure Quiz (5 cards)';
const QUIZ_FILTER_LABEL_EMPTY = 'Cell Structure Quiz (0 cards)';

/** The three questions belonging to "Cell Structure Quiz" in the cellStructure fixture. */
const PRACTICE_QUIZ_QUESTIONS = [
  { search: 'organelle is responsible', prompt: 'Which organelle is responsible for producing ATP?' },
  { search: 'Prokaryotic', prompt: 'Prokaryotic cells have a membrane-bound nucleus.' },
  { search: 'ribosomes', prompt: 'Fill in the blank:' },
] as const;

/** Opens the workspace Flashcards tab and waits for deck setup. */
async function openDeckSetup(page: Page) {
  const flashcardsTab = page.getByRole('button', { name: 'Flashcards' });
  await expect(flashcardsTab).toBeVisible();
  await flashcardsTab.click();
  await expect(
    page.getByRole('heading', { name: 'Flashcards & Spaced Repetition' }),
  ).toBeVisible({ timeout: 10000 });
}

/** Selects a quiz in the setup view filter dropdown. */
async function selectQuizFilter(page: Page, label: string) {
  const quizFilter = page.getByLabel('Quiz Filter');
  await expect(quizFilter).toBeVisible({ timeout: 5000 });
  await quizFilter.selectOption({ label });
}

/** Flips the current card and rates it as Good. */
async function flipAndRateGood(page: Page) {
  const frontFacingCard = page.getByRole('button', { name: 'Show answer', exact: true });
  await expect(frontFacingCard).toBeVisible();
  await frontFacingCard.click();
  await expect(page.getByRole('button', { name: 'Show question', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Good/i }).click();
}

/** Opens the workspace's Question Bank tab in the Manage tier. */
async function openQuestionBank(page: Page, workspaceUrl: string) {
  await page.goto(workspaceUrl);

  const manageMode = page.getByRole('tab', { name: 'Manage' });
  await expect(manageMode).toBeVisible();
  await manageMode.click();

  const questionBankTab = page.getByRole('button', { name: 'Question Bank' });
  await expect(questionBankTab).toBeVisible();
  await questionBankTab.click();

  await expect(page.getByRole('textbox', { name: 'Search questions' })).toBeVisible();
}

/** Archives a question in the Question Bank and confirms the dialog. */
async function archiveQuestion(page: Page, searchText: string, prompt: string) {
  const searchInput = page.getByRole('textbox', { name: 'Search questions' });
  await searchInput.fill(searchText);

  const archiveButton = page.getByRole('button', { name: `Archive question: ${prompt}` });
  await expect(archiveButton).toBeVisible();
  await archiveButton.click();

  const confirmDialog = page.getByRole('dialog');
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Archive', exact: true }).click();

  await expect(page.getByRole('button', { name: `Restore question: ${prompt}` })).toBeVisible();
}

/** Switches from the Manage tier back to the Study tier and opens Flashcards. */
async function switchToFlashcards(page: Page) {
  const studyMode = page.getByRole('tab', { name: 'Study' });
  await expect(studyMode).toBeVisible();
  await studyMode.click();
  await openDeckSetup(page);
}

/**
 * Asserts that the empty deck note uses the secondary text role and
 * does not use error tokens or alert semantics.
 */
async function assertNotAnErrorState(reasonElement: Locator) {
  await expect(reasonElement).not.toHaveAttribute('role', 'alert');

  const { isSecondary, isError } = await reasonElement.evaluate((el) => {
    const computedColor = window.getComputedStyle(el).color;

    const dummySecondary = document.createElement('div');
    dummySecondary.style.color = 'var(--color-text-secondary)';
    document.body.appendChild(dummySecondary);
    const expectedSecondaryColor = window.getComputedStyle(dummySecondary).color;
    dummySecondary.remove();

    const dummyError = document.createElement('div');
    dummyError.style.color = 'var(--color-error)';
    document.body.appendChild(dummyError);
    const expectedErrorColor = window.getComputedStyle(dummyError).color;
    dummyError.remove();

    return {
      isSecondary: computedColor === expectedSecondaryColor,
      isError: computedColor === expectedErrorColor,
    };
  });

  expect(isSecondary).toBe(true);
  expect(isError).toBe(false);
}

test.describe('Flashcard Empty Deck States E2E', () => {
  let workspaceUrl: string;

  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);
    await routeShare(page, cellStructure);
    workspaceUrl = await cloneShareToLibrary(page, cellStructure, 'flashcards');
  });

  test('disables Start when nothing is due, links real relative next-due label via aria-describedby, and uses non-error styling', async ({
    page,
  }) => {
    await openDeckSetup(page);

    // 1. Filter to "Cell Structure Quiz (5 cards)" and start the session
    await selectQuizFilter(page, QUIZ_FILTER_LABEL_INITIAL);
    const startButton = page.getByRole('button', { name: 'Start Flashcard Session' });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // 2. Review all 5 cards in the quiz with real SM-2 "Good" ratings (1-day forward interval)
    for (let cardIndex = 1; cardIndex <= 5; cardIndex++) {
      await expect(page.getByText(`Card ${cardIndex} of 5`)).toBeVisible({ timeout: 5000 });
      await flipAndRateGood(page);
    }

    // 3. Wait for session completion summary and return to deck setup
    await expect(page.getByRole('heading', { name: 'Session Complete!' })).toBeVisible({ timeout: 5000 });
    const backToSetupButton = page.getByRole('button', { name: 'Back to Deck Setup' });
    await expect(backToSetupButton).toBeVisible();
    await backToSetupButton.click();

    await expect(
      page.getByRole('heading', { name: 'Flashcards & Spaced Repetition' }),
    ).toBeVisible({ timeout: 5000 });

    // 4. Select the practice quiz again in the default "Due Cards Only" mode.
    // Every card in this quiz now has a future dueAt (scheduled 1 day forward).
    await selectQuizFilter(page, QUIZ_FILTER_LABEL_INITIAL);

    // Start button must be disabled
    await expect(startButton).toBeDisabled();

    // 5. Accessibility wiring: aria-describedby must link to the blocked reason element
    const describedById = await startButton.getAttribute('aria-describedby');
    expect(describedById).toBe('flashcard-deck-blocked-reason');

    const reasonElement = page.locator(`#${describedById}`);
    await expect(reasonElement).toBeVisible();

    // 6. Assert real next-due label: reviewed moments ago with 1-day interval,
    // so diffMs is ~24 hours and describeDeckEmptyState quotes the real relative time.
    await expect(reasonElement).toHaveText(
      /Nothing due right now — the next card is due (in 24 hours|tomorrow)\./,
    );

    // 7. Not an error state: secondary text styling, no error token, no alert role
    await assertNotAnErrorState(reasonElement);

    // 8. Switching to "All Cards" re-enables Start and clears the reason
    const allCardsModeBtn = page.getByRole('button', { name: /Review entire deck/ });
    await allCardsModeBtn.click();
    await expect(startButton).toBeEnabled();
    await expect(reasonElement).toHaveCount(0);

    // Switching back to "Due Cards Only" disables Start again with the reason restored
    const dueOnlyModeBtn = page.getByRole('button', { name: /Focus on/ });
    await dueOnlyModeBtn.click();
    await expect(startButton).toBeDisabled();
    await expect(reasonElement).toBeVisible();
    await expect(reasonElement).toHaveText(
      /Nothing due right now — the next card is due (in 24 hours|tomorrow)\./,
    );
  });

  test('disables Start when quiz selection yields no cards, names the quiz, and is distinguishable from nothing-due', async ({
    page,
  }) => {
    // 1. Archive all questions belonging to "Cell Structure Quiz" via the Question Bank
    await openQuestionBank(page, workspaceUrl);
    for (const q of PRACTICE_QUIZ_QUESTIONS) {
      await archiveQuestion(page, q.search, q.prompt);
    }

    // 2. Return to the Flashcards setup view
    await switchToFlashcards(page);

    // 3. The quiz filter now reflects 0 cards for "Cell Structure Quiz"
    await selectQuizFilter(page, QUIZ_FILTER_LABEL_EMPTY);

    const startButton = page.getByRole('button', { name: 'Start Flashcard Session' });
    await expect(startButton).toBeDisabled();

    // 4. Accessibility wiring
    const describedById = await startButton.getAttribute('aria-describedby');
    expect(describedById).toBe('flashcard-deck-blocked-reason');

    const reasonElement = page.locator(`#${describedById}`);
    await expect(reasonElement).toBeVisible();

    // 5. Names the quiz title as the cause and directs the user to change filter
    const expectedEmptyText =
      'Cell Structure Quiz has no flashcards to study. Change the Quiz Filter, or select All Quizzes, to start a session.';
    await expect(reasonElement).toHaveText(expectedEmptyText);

    // 6. Distinct from the nothing-due state: does NOT claim cards are scheduled forward
    await expect(reasonElement).not.toHaveText(/Nothing due right now/);
    await expect(reasonElement).not.toHaveText(/the next card is due/);

    // 7. Not an error state: secondary text styling, no error token, no alert role
    await assertNotAnErrorState(reasonElement);

    // 8. Switching back to "All Quizzes" re-enables Start and clears the reason
    await selectQuizFilter(page, 'All Quizzes (50 cards)');
    await expect(startButton).toBeEnabled();
    await expect(reasonElement).toHaveCount(0);
  });
});
