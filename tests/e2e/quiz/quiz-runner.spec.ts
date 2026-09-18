import { test, expect } from '@playwright/test';
import { setupImportedMaterial, resetDatabase } from '../helpers/e2e-setup';

test.describe('Assessment Engine & Live Quiz Runner E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupImportedMaterial(page, 'cell-structure');
  });

  test('completes a quiz with all correct answers and displays a 100% passing result', async ({
    page,
  }) => {
    // 1. Switch to Quiz workspace tab
    const quizTab = page.getByRole('button', { name: 'Quiz' });
    await expect(quizTab).toBeVisible();
    await quizTab.click();

    // 2. Select and start the focused 2-question "Cell Structure Quiz"
    const quizHeading = page.getByRole('heading', { name: 'Cell Structure Quiz' });
    await expect(quizHeading).toBeVisible({ timeout: 10000 });

    const quizCard = quizHeading.locator('..').locator('..');
    const startButton = quizCard.getByRole('button', { name: /Start Quiz/i });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 3. Question 1 (Multiple Choice): "Which organelle is responsible for producing ATP?"
    await expect(
      page.getByText('Which organelle is responsible for producing ATP?'),
    ).toBeVisible({ timeout: 5000 });

    // Select correct answer: Mitochondria
    const mitochondriaChoice = page.getByLabel('Mitochondria');
    await expect(mitochondriaChoice).toBeVisible();
    await mitochondriaChoice.check();

    // Navigate to next question
    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // 4. Question 2 (True/False): "Prokaryotic cells have a membrane-bound nucleus."
    await expect(
      page.getByText('Prokaryotic cells have a membrane-bound nucleus.'),
    ).toBeVisible({ timeout: 5000 });

    // Select correct answer: False
    const falseChoice = page.getByLabel('False');
    await expect(falseChoice).toBeVisible();
    await falseChoice.check();

    // 5. Submit the completed quiz
    const submitButton = page.getByRole('button', { name: 'Submit Quiz' });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // 6. Assert Results View observable contracts
    await expect(page.getByText('100%')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2 / 2 points earned')).toBeVisible();
    await expect(page.getByText('2 correct')).toBeVisible();
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

    const quizCard = quizHeading.locator('..').locator('..');
    const startButton = quizCard.getByRole('button', { name: /Start Quiz/i });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 3. Question 1 (Multiple Choice): Select intentionally wrong answer (Ribosome)
    await expect(
      page.getByText('Which organelle is responsible for producing ATP?'),
    ).toBeVisible({ timeout: 5000 });

    const wrongChoice = page.getByLabel('Ribosome');
    await wrongChoice.check();

    const nextButton = page.getByRole('button', { name: 'Next' });
    await nextButton.click();

    // 4. Question 2 (True/False): Select correct answer (False)
    await expect(
      page.getByText('Prokaryotic cells have a membrane-bound nucleus.'),
    ).toBeVisible({ timeout: 5000 });

    const falseChoice = page.getByLabel('False');
    await falseChoice.check();

    // 5. Submit quiz
    const submitButton = page.getByRole('button', { name: 'Submit Quiz' });
    await submitButton.click();

    // 6. Assert Results View reflects 1 correct / 1 incorrect and 50% score
    await expect(page.getByText('50%')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1 / 2 points earned')).toBeVisible();
    await expect(page.getByText('1 correct')).toBeVisible();
    await expect(page.getByText('1 incorrect')).toBeVisible();
  });
});
