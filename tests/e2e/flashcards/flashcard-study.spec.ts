import { test, expect, type Page } from '@playwright/test';
import { resetDatabase, setupApiMocks } from '../helpers/e2e-setup';
import { cloneShareToLibrary, routeShare } from '../helpers/share-seed';
import { cellStructure } from '../helpers/fixtures/cellStructure';

/**
 * The canonical "Cell Structure Quiz" the flashcard specs filter to.
 *
 * Three questions, but FIVE cards: the third is the fixture's only multi-blank
 * `fill_in_blank` question, and `questionToCards` projects one card per blank so
 * each blank carries its own SM-2 schedule. The option label counts CARDS, so the
 * "5" in it is the first end-to-end proof that the projection is plural.
 */
const QUIZ_FILTER_LABEL = 'Cell Structure Quiz (5 cards)';

/**
 * The cloze question's three per-blank fronts. The target blank stays `___` and
 * every other blank is filled with its own answer (Anki cloze retrieval
 * context), so these are the exact strings the player must render. They are
 * mutually distinct, which is what makes an exact-text match meaningful: a bare
 * substring match would happily hit a sibling blank's answer on the same face.
 */
const CLOZE_FRONTS = [
  'DNA is stored in the ___, most ATP is generated in the mitochondria, and proteins are synthesized on the ribosomes.',
  'DNA is stored in the nucleus, most ATP is generated in the ___, and proteins are synthesized on the ribosomes.',
  'DNA is stored in the nucleus, most ATP is generated in the mitochondria, and proteins are synthesized on the ___.',
];

/** One answer per blank, in blank order. */
const CLOZE_ANSWERS = ['nucleus', 'mitochondria', 'ribosomes'];

/** The legacy whole-question back — what a per-blank back must never show. */
const CLOZE_JOINED_ANSWERS = CLOZE_ANSWERS.join(', ');

/** Opens the material workspace's Flashcards tab and waits for deck setup. */
async function openDeckSetup(page: Page) {
  const flashcardsTab = page.getByRole('button', { name: 'Flashcards' });
  await expect(flashcardsTab).toBeVisible();
  await flashcardsTab.click();
  await expect(
    page.getByRole('heading', { name: 'Flashcards & Spaced Repetition' }),
  ).toBeVisible({ timeout: 10000 });
}

/** Re-picks the practice quiz — the setup view resets its filter on remount. */
async function selectPracticeQuiz(page: Page) {
  const quizFilter = page.getByLabel('Quiz Filter');
  await expect(quizFilter).toBeVisible({ timeout: 5000 });
  await quizFilter.selectOption({ label: QUIZ_FILTER_LABEL });
}

/** Starts a session on the practice quiz and waits for the first card. */
async function startPracticeSession(page: Page, firstCardProgress: string) {
  await selectPracticeQuiz(page);
  const startSessionButton = page.getByRole('button', { name: 'Start Flashcard Session' });
  await expect(startSessionButton).toBeVisible();
  await startSessionButton.click();
  await expect(page.getByText(firstCardProgress)).toBeVisible({ timeout: 5000 });
}

/**
 * Flips the current card and returns it.
 *
 * The flip card's accessible name encodes the flip state ("Show answer" →
 * "Show question"), so the returned locator both asserts the flip happened and
 * scopes every face-scoped assertion. Only one card is mounted at a time (keyed
 * by card identity), so the scope is never ambiguous.
 */
async function flipCard(page: Page) {
  const frontFacingCard = page.getByRole('button', { name: 'Show answer', exact: true });
  await expect(frontFacingCard).toBeVisible();
  await frontFacingCard.click();
  const flippedCard = page.getByRole('button', { name: 'Show question', exact: true });
  await expect(flippedCard).toBeVisible();
  return flippedCard;
}

/** Flips the current card and submits a rating, advancing the deck. */
async function flipAndRate(page: Page, rating: RegExp) {
  await flipCard(page);
  await page.getByRole('button', { name: rating }).click();
}

test.describe('Spaced Repetition Flashcard Study E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);
    await routeShare(page, cellStructure);
    await cloneShareToLibrary(page, cellStructure, 'flashcards');
  });

  test('reviews flashcard deck with 3D flip card, rates retention, and persists review state across reload', async ({
    page,
  }) => {
    // 1-2. Flashcard deck setup view is presented.
    await openDeckSetup(page);

    // 3. Filter to the focused 3-question "Cell Structure Quiz". The option label
    //    counts CARDS, not questions — a fill_in_blank question projects to one
    //    card per blank, so the cloze question alone contributes 3 of these 5.
    // 4. Start the flashcard study session.
    await startPracticeSession(page, 'Card 1 of 5');

    // 5. Card 1 front face is visible with question prompt
    await expect(
      page.getByText('Which organelle is responsible for producing ATP?'),
    ).toBeVisible({ timeout: 5000 });

    // Flip card to reveal answer
    const card1 = await flipCard(page);

    // Card 1 back face reveals the correct answer and explanation.
    // Choice cards render their options on BOTH faces — a 3D flip keeps both in
    // the DOM — so the answer text alone is ambiguous. Assert the graded state,
    // which exists only on the back face and also proves the correct marking.
    await expect(card1.getByLabel('Mitochondria — correct answer')).toBeVisible();
    await expect(card1.getByText(/powerhouse of the cell/i)).toBeVisible();

    // Rate recall as "Good"
    await page.getByRole('button', { name: /Good/i }).click();

    // 6. Card 2 front face is visible
    await expect(page.getByText('Card 2 of 5')).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText('Prokaryotic cells have a membrane-bound nucleus.'),
    ).toBeVisible({ timeout: 5000 });

    // Flip card 2
    const card2 = await flipCard(page);

    // Card 2 back face reveals "False"
    await expect(card2.getByText('False', { exact: true })).toBeVisible();

    // Rate recall as "Easy"
    await page.getByRole('button', { name: /Easy/i }).click();

    // 7. Card 3 is the FIRST BLANK of the multi-blank cloze question — a card in
    //    its own right, not a third question. Its front leaves blank 0 as `___`
    //    and fills blanks 1 and 2 with their answers (Anki cloze context), and
    //    exactly one marker survives.
    await expect(page.getByText('Card 3 of 5')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(CLOZE_FRONTS[0], { exact: true })).toBeVisible();
    await expect(page.getByText('___')).toHaveCount(1);

    const card3 = await flipCard(page);

    // The back is THAT blank's answer alone — never the joined list, which is
    // what the old whole-question card showed. Scoped to the flipped card
    // because the front carries the sibling answers as literal text.
    await expect(card3.getByText(CLOZE_ANSWERS[0], { exact: true })).toBeVisible();
    await expect(card3.getByText(CLOZE_JOINED_ANSWERS)).toHaveCount(0);

    await page.getByRole('button', { name: /Good/i }).click();

    // 8. Card 4 is a SEPARATE card for the SECOND blank: the complementary
    //    rendering, with the target moved and the first blank now filled in. The
    //    exact-text assertion is what proves this is not card 3's front
    //    re-rendered — a one-card-per-question projection could never show it.
    await expect(page.getByText('Card 4 of 5')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(CLOZE_FRONTS[1], { exact: true })).toBeVisible();
    await expect(page.getByText(CLOZE_FRONTS[0], { exact: true })).toHaveCount(0);
    await expect(page.getByText('___')).toHaveCount(1);

    const card4 = await flipCard(page);

    // Back is the second blank's answer alone.
    await expect(card4.getByText(CLOZE_ANSWERS[1], { exact: true })).toBeVisible();
    await expect(card4.getByText(CLOZE_JOINED_ANSWERS)).toHaveCount(0);

    await page.getByRole('button', { name: /Good/i }).click();

    // 9. Card 5 closes the cloze question with the third blank.
    await expect(page.getByText('Card 5 of 5')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(CLOZE_FRONTS[2], { exact: true })).toBeVisible();
    await expect(page.getByText(CLOZE_FRONTS[0], { exact: true })).toHaveCount(0);
    await expect(page.getByText(CLOZE_FRONTS[1], { exact: true })).toHaveCount(0);
    await expect(page.getByText('___')).toHaveCount(1);

    const card5 = await flipCard(page);
    await expect(card5.getByText(CLOZE_ANSWERS[2], { exact: true })).toBeVisible();
    await expect(card5.getByText(CLOZE_JOINED_ANSWERS)).toHaveCount(0);

    await page.getByRole('button', { name: /Good/i }).click();

    // 10. Session End summary view is displayed
    await expect(
      page.getByRole('heading', { name: 'Session Complete!' }),
    ).toBeVisible({ timeout: 5000 });
    // 5 cards, not 3: the two non-cloze questions project 1:1 (2 cards) and the
    // one 3-blank cloze question projects 1:3 (3 cards). 2 + 3 = 5.
    await expect(page.getByText(/You reviewed 5 cards/i)).toBeVisible();

    // Return to deck setup
    const backToSetupButton = page.getByRole('button', {
      name: 'Back to Deck Setup',
    });
    await expect(backToSetupButton).toBeVisible();
    await backToSetupButton.click();

    // 11. Verify deck reflects updated state in UI
    await expect(
      page.getByRole('heading', { name: 'Flashcards & Spaced Repetition' }),
    ).toBeVisible();

    // 12. Reload page to verify review state persisted in Dexie
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

  test('schedules each blank of one cloze question on its own SM-2 schedule', async ({ page }) => {
    // 1. The deck's own counts are already a 1:N proof: 53 published questions
    //    project to 55 cards, because the single multi-blank cloze question
    //    contributes 3. The study-mode buttons encode those counts in their
    //    accessible names, so this asserts the projection through the UI without
    //    a bare text match that a sibling badge could collide with.
    await openDeckSetup(page);
    await expect(
      page.getByRole('button', { name: /Review entire deck \(55 cards; due cards first\)/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Focus on 55 cards due for scheduled review today/ }),
    ).toBeVisible();

    // 2. Rate the first three cards of the practice quiz: the multiple choice,
    //    the true/false, and the cloze question's FIRST blank. "Good"/"Easy" on a
    //    new card schedules it one day out, so all three leave today's due pool.
    await startPracticeSession(page, 'Card 1 of 5');
    await flipAndRate(page, /Good/i);
    await flipAndRate(page, /Easy/i);
    await flipAndRate(page, /Good/i);
    await expect(page.getByText('Card 4 of 5')).toBeVisible({ timeout: 5000 });

    // 3. Back to deck setup: 55 - 3 = 52 cards are still new. That the loss is 3
    //    and not 5 is the whole point. Rating ONE blank retired exactly that
    //    blank, so the same question's other two blanks kept their own
    //    (unreviewed) schedules; a shared per-question schedule would have
    //    retired all three and left 50.
    await page.getByRole('button', { name: 'Exit session', exact: true }).click();
    await expect(
      page.getByRole('button', { name: /Review entire deck \(55 cards; due cards first\)/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Focus on 52 cards due for scheduled review today/ }),
    ).toBeVisible();

    // 4. Start a second session on the same quiz. The setup view remounted, so it
    //    defaulted back to "Due Cards Only" (52 cards are still due) and reset
    //    the filter to "All Quizzes" — hence the re-selection. The session is
    //    2 cards: the two un-rated blanks. The rated blank is scheduled for
    //    tomorrow and is therefore absent, so under a shared schedule the deck
    //    would be empty and this session could not have started at all.
    await startPracticeSession(page, 'Card 1 of 2');

    // 5. The deck now LEADS with the second blank — still a new card, still on
    //    its own schedule — not with the cloze question's already-rated first
    //    blank, which SM-2 has pushed out of today's due pool.
    await expect(page.getByText(CLOZE_FRONTS[1], { exact: true })).toBeVisible();
    await expect(page.getByText(CLOZE_FRONTS[0], { exact: true })).toHaveCount(0);
    await expect(page.getByText('___')).toHaveCount(1);

    const secondBlankCard = await flipCard(page);
    await expect(secondBlankCard.getByText(CLOZE_ANSWERS[1], { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Good/i }).click();

    // 6. The third blank follows as its own new card with the complementary
    //    rendering — the question was re-rated blank by blank, never as a unit.
    await expect(page.getByText('Card 2 of 2')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(CLOZE_FRONTS[2], { exact: true })).toBeVisible();
    await expect(page.getByText('___')).toHaveCount(1);

    const thirdBlankCard = await flipCard(page);
    await expect(thirdBlankCard.getByText(CLOZE_ANSWERS[2], { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Good/i }).click();

    await expect(
      page.getByRole('heading', { name: 'Session Complete!' }),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/You reviewed 2 cards/i)).toBeVisible();
  });
});
