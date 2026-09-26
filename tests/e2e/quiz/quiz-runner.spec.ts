import { test, expect } from '@playwright/test';
import { resetDatabase, setupApiMocks } from '../helpers/e2e-setup';
import { cloneShareToLibrary, routeShare } from '../helpers/share-seed';
import { cellStructure } from '../helpers/fixtures/cellStructure';

test.describe('Assessment Engine & Live Quiz Runner E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);
    await routeShare(page, cellStructure);
    // Seed the library the way a user does: clone the canonical share, then open it.
    await cloneShareToLibrary(page, cellStructure, 'read');
  });

  test('completes a quiz with all correct answers and displays a 100% passing result', async ({
    page,
  }) => {
    // 1. Switch to Quiz workspace tab
    const quizTab = page.getByRole('button', { name: 'Quiz' });
    await expect(quizTab).toBeVisible();
    await quizTab.click();

    // 2. Select and start the focused 3-question "Cell Structure Quiz"
    const quizHeading = page.getByRole('heading', { name: 'Cell Structure Quiz' });
    await expect(quizHeading).toBeVisible({ timeout: 10000 });

    const quizCard = page.locator('[data-quiz-id]').filter({
      has: page.getByRole('heading', { name: 'Cell Structure Quiz', exact: true }),
    });
    const startButton = quizCard.getByRole('button', { name: /Start Quiz/i });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 3. Question 1 (Multiple Choice): "Which organelle is responsible for producing ATP?"
    await expect(page.getByText('Question 1 of 3')).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText('Which organelle is responsible for producing ATP?'),
    ).toBeVisible({ timeout: 5000 });

    // Select correct answer: Mitochondria.
    // Scoped to the radio role: the reader's document outline also exposes
    // buttons whose accessible names are the document's heading text, including
    // "Mitochondria" and "Ribosomes" (the material has those sections).
    const mitochondriaChoice = page.getByRole('radio', { name: 'Mitochondria', exact: true });
    await expect(mitochondriaChoice).toBeVisible();
    await mitochondriaChoice.check();

    // Navigate to next question
    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // 4. Question 2 (True/False): "Prokaryotic cells have a membrane-bound nucleus."
    await expect(page.getByText('Question 2 of 3')).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText('Prokaryotic cells have a membrane-bound nucleus.'),
    ).toBeVisible({ timeout: 5000 });

    // Select correct answer: False
    const falseChoice = page.getByRole('radio', { name: 'False', exact: true });
    await expect(falseChoice).toBeVisible();
    await falseChoice.check();

    await page.getByRole('button', { name: 'Next' }).click();

    // 5. Question 3 (Fill in the Blank, three blanks). Each blank is located by
    //    its own placeholder, because the inputs sit inline in one sentence — a
    //    text match on an answer would collide with the template itself.
    await expect(page.getByText('Question 3 of 3')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Fill in the blank:')).toBeVisible();
    await page.getByPlaceholder('blank 1').fill('nucleus');
    await page.getByPlaceholder('blank 2').fill('mitochondria');
    await page.getByPlaceholder('blank 3').fill('ribosomes');

    // 6. Submit the completed quiz
    const submitButton = page.getByRole('button', { name: 'Submit Quiz' });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // 7. Assert Results View observable contracts
    await expect(page.getByText('100%')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('3 / 3 points earned')).toBeVisible();
    await expect(page.getByText('3 correct')).toBeVisible();
    await expect(page.getByText('0 incorrect')).toBeVisible();

    // Assert explanation feedback is presented in the breakdown
    await expect(
      page.getByText(/Mitochondria are the powerhouse of the cell/i),
    ).toBeVisible();
  });

  test('submits an incorrect answer and displays the calculated score with error feedback', async ({
    page,
  }) => {
    // 1. Switch to Quiz workspace tab
    const quizTab = page.getByRole('button', { name: 'Quiz' });
    await expect(quizTab).toBeVisible();
    await quizTab.click();

    // 2. Start "Cell Structure Quiz"
    const quizHeading = page.getByRole('heading', { name: 'Cell Structure Quiz' });
    await expect(quizHeading).toBeVisible({ timeout: 10000 });

    const quizCard = page.locator('[data-quiz-id]').filter({
      has: page.getByRole('heading', { name: 'Cell Structure Quiz', exact: true }),
    });
    const startButton = quizCard.getByRole('button', { name: /Start Quiz/i });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 3. Question 1 (Multiple Choice): Select intentionally wrong answer (Ribosome)
    await expect(page.getByText('Question 1 of 3')).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText('Which organelle is responsible for producing ATP?'),
    ).toBeVisible({ timeout: 5000 });

    const wrongChoice = page.getByRole('radio', { name: 'Ribosome', exact: true });
    await wrongChoice.check();

    const nextButton = page.getByRole('button', { name: 'Next' });
    await nextButton.click();

    // 4. Question 2 (True/False): Select correct answer (False)
    await expect(page.getByText('Question 2 of 3')).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText('Prokaryotic cells have a membrane-bound nucleus.'),
    ).toBeVisible({ timeout: 5000 });

    const falseChoice = page.getByRole('radio', { name: 'False', exact: true });
    await falseChoice.check();

    await page.getByRole('button', { name: 'Next' }).click();

    // 5. Question 3 (Fill in the Blank): all three blanks correct, so exactly one
    //    wrong answer remains in the session.
    await expect(page.getByText('Question 3 of 3')).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('blank 1').fill('nucleus');
    await page.getByPlaceholder('blank 2').fill('mitochondria');
    await page.getByPlaceholder('blank 3').fill('ribosomes');

    // 6. Submit quiz
    const submitButton = page.getByRole('button', { name: 'Submit Quiz' });
    await submitButton.click();

    // 7. Assert Results View reflects 2 correct / 1 incorrect and 67% score
    await expect(page.getByText('67%')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2 / 3 points earned')).toBeVisible();
    await expect(page.getByText('2 correct')).toBeVisible();
    await expect(page.getByText('1 incorrect')).toBeVisible();
  });
});
