import { test, expect, type Page } from '@playwright/test';
import { resetDatabase, setupApiMocks } from '../helpers/e2e-setup';
import { cloneShareToLibrary, routeShare } from '../helpers/share-seed';
import { cellStructure } from '../helpers/fixtures/cellStructure';
import type { PackageQuestion } from '../../../src/domain/package/models/package.types';

/**
 * The Insights surface (`/analytics`) in a real browser.
 *
 * Three claims are proven here that a jsdom test cannot prove:
 *
 *  1. **The maturity total is a CARD count, not a question count.** This fixture
 *     is the only one carrying a multi-blank `fill_in_blank` question, so its
 *     question count and its card count genuinely differ (53 vs 55) and a pool
 *     that had regressed to questions would render 53.
 *  2. **A stranded schedule is disclosed, never absorbed.** Archiving a question
 *     takes its cards out of the active pool while its review rows survive, so
 *     those reviews become diagnostics: no bucket, no percentage, and no place in
 *     the total — just the footnote.
 *  3. **A question write reaches the analytics screen.** Both archives are
 *     ordinary UI actions that invalidate the `['analytics']` namespace through
 *     the composition-root decorator, and the Insights figures afterwards are
 *     recomputed from the real store rather than served from the pre-archive
 *     pool. (A mount-time refetch would also refresh them, so this pins the
 *     end-to-end result of the wiring, not the invalidation call in isolation.)
 *
 * Seeding is the live `/api/shares` clone flow and every mutation is a real user
 * action on fixture content — nothing reaches into IndexedDB. The workspace URL
 * is the one `cloneShareToLibrary` captured, never a hand-built id.
 */

/** One card per non-cloze question; one per blank for a `fill_in_blank` question. */
function projectedCardCount(questions: readonly PackageQuestion[]): number {
    return questions.reduce((total, question) => {
        if (question.payload.type === 'fill_in_blank') {
            return total + question.payload.blanks.length;
        }
        return total + 1;
    }, 0);
}

const FIXTURE_QUESTIONS = cellStructure.package.questions;
/** 52 one-card questions plus the fixture's single 3-blank cloze question's 3 cards. */
const POOL_CARDS = projectedCardCount(FIXTURE_QUESTIONS);
const POOL_QUESTIONS = FIXTURE_QUESTIONS.length;

/** The focused practice quiz: 3 questions, 5 cards (the cloze contributes 3). */
const QUIZ_FILTER_LABEL = 'Cell Structure Quiz (5 cards)';

/**
 * The two 1:1 questions this spec rates, and then archives. Both belong to the
 * practice quiz, so the Question Bank gates each archive behind a confirmation.
 */
const RATED_CHOICE_PROMPT = 'Which organelle is responsible for producing ATP?';
const RATED_TRUE_FALSE_PROMPT = 'Prokaryotic cells have a membrane-bound nucleus.';

/** The count label on the maturity card — the projected pool, not a question count. */
function poolTotalLabel(cards: number): string {
    return `${cards} total flashcards`;
}

/** Opens the workspace's Question Bank (the Manage tier) from the captured URL. */
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

/**
 * Archives one question through the Question Bank and waits for the row to
 * report the new state.
 *
 * Archive is a *soft* delete: the question row survives, only its card keys leave
 * the active pool. That is precisely what strands its review rows, and it is why
 * the footnote must not claim the card was deleted.
 */
async function archiveQuestion(page: Page, searchText: string, prompt: string) {
    await page.getByRole('textbox', { name: 'Search questions' }).fill(searchText);

    const archiveButton = page.getByRole('button', { name: `Archive question: ${prompt}` });
    await expect(archiveButton).toBeVisible();
    await archiveButton.click();

    // The question is in a published quiz, so the bank confirms first. Scoped to
    // the dialog: the card's own archive control is a sibling, not a descendant.
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Archive', exact: true }).click();

    // The Restore control only exists for an archived question, so its arrival is
    // the state assertion.
    await expect(page.getByRole('button', { name: `Restore question: ${prompt}` })).toBeVisible();
}

/** Opens the workspace's Flashcards tab and waits for deck setup. */
async function openDeckSetup(page: Page) {
    const flashcardsTab = page.getByRole('button', { name: 'Flashcards' });
    await expect(flashcardsTab).toBeVisible();
    await flashcardsTab.click();
    await expect(
        page.getByRole('heading', { name: 'Flashcards & Spaced Repetition' }),
    ).toBeVisible({ timeout: 10000 });
}

/** Starts a session on the practice quiz and waits for the first card. */
async function startPracticeSession(page: Page) {
    await page.getByLabel('Quiz Filter').selectOption({ label: QUIZ_FILTER_LABEL });
    const startSession = page.getByRole('button', { name: 'Start Flashcard Session' });
    await expect(startSession).toBeVisible();
    await startSession.click();
    await expect(page.getByText('Card 1 of 5')).toBeVisible({ timeout: 5000 });
}

/**
 * Flips the current card and rates it, recording a real SM-2 schedule for that
 * card's key. The flip card's accessible name encodes the flip state, so the
 * locator asserts the flip happened before the rating is submitted.
 */
async function flipAndRateGood(page: Page) {
    const frontFacingCard = page.getByRole('button', { name: 'Show answer', exact: true });
    await expect(frontFacingCard).toBeVisible();
    await frontFacingCard.click();
    await expect(page.getByRole('button', { name: 'Show question', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Good/i }).click();
}

/** Navigates to Insights through the primary nav and waits for the dashboard. */
async function openInsights(page: Page) {
    const nav = page.getByRole('navigation', { name: 'Desktop Navigation' });
    await nav.getByRole('button', { name: 'Insights' }).click();
    await expect(page.getByRole('heading', { name: 'Learning Insights' })).toBeVisible({ timeout: 10000 });
}

test.describe('Learning Insights E2E', () => {
    let workspaceUrl: string;

    test.beforeEach(async ({ page }) => {
        await resetDatabase(page);
        await setupApiMocks(page);
        await routeShare(page, cellStructure);
        workspaceUrl = await cloneShareToLibrary(page, cellStructure, 'flashcards');
    });

    test('reports the projected card pool rather than a question count', async ({ page }) => {
        // The arithmetic, taken from the payload rather than assumed: a question
        // count would be 53 and the card pool is 55, because the one 3-blank cloze
        // question projects three cards. Both numbers are asserted so the gap the
        // screen is measuring can never silently close.
        expect(POOL_QUESTIONS).toBe(53);
        expect(POOL_CARDS).toBe(55);
        expect(POOL_CARDS).not.toBe(POOL_QUESTIONS);

        // One real review, so the screen has data to report (a fresh library
        // renders the empty state instead of the dashboard).
        await openDeckSetup(page);
        await startPracticeSession(page);
        await flipAndRateGood(page);
        await expect(page.getByText('Card 2 of 5')).toBeVisible({ timeout: 5000 });
        await page.getByRole('button', { name: 'Exit session', exact: true }).click();

        await openInsights(page);

        // The card count, not 53 questions.
        await expect(page.getByText(poolTotalLabel(POOL_CARDS), { exact: true })).toBeVisible();

        // One reviewed card is learning (SM-2's one-day first interval); the other
        // 54 are new. The legend renders count and share together, so the pair
        // proves both the bucket and that it is measured against 55.
        await expect(page.getByText('1(2%)', { exact: true })).toBeVisible();
        await expect(page.getByText('54(98%)', { exact: true })).toBeVisible();

        // No schedule is stranded yet, so the footnote renders nothing at all.
        await expect(page.getByText(/active card pool/)).toHaveCount(0);

        // The overview's "cards with history" figure is scoped to the same pool,
        // and says so: one review, on a card that still exists.
        await expect(page.getByText('1 active card with history', { exact: true })).toBeVisible();
    });

    test('discloses schedules stranded by archived questions without moving any bar total', async ({ page }) => {
        // Rate the first two cards of the practice quiz — one multiple choice and
        // one true/false, both 1:1 questions, so two keys and two review rows.
        await openDeckSetup(page);
        await startPracticeSession(page);
        await flipAndRateGood(page);
        await expect(page.getByText('Card 2 of 5')).toBeVisible({ timeout: 5000 });
        await flipAndRateGood(page);
        await expect(page.getByText('Card 3 of 5')).toBeVisible({ timeout: 5000 });
        await page.getByRole('button', { name: 'Exit session', exact: true }).click();

        await openInsights(page);
        await expect(page.getByText(poolTotalLabel(POOL_CARDS), { exact: true })).toBeVisible();
        await expect(page.getByText('2(4%)', { exact: true })).toBeVisible();
        await expect(page.getByText(/active card pool/)).toHaveCount(0);

        // Archive both rated questions. Each takes exactly one key out of the pool
        // and leaves its review row behind, so the pool drops by 2 (55 -> 53) while
        // the remaining question count (51) must not be what the screen reports.
        await openQuestionBank(page, workspaceUrl);
        await archiveQuestion(page, 'organelle is responsible', RATED_CHOICE_PROMPT);
        await archiveQuestion(page, 'Prokaryotic', RATED_TRUE_FALSE_PROMPT);

        await openInsights(page);

        // Refreshed after the two writes that invalidate the analytics cache: the
        // total is the recomputed pool of 53 projected cards — neither the stale
        // 55 nor the 51 remaining questions, and never 55 + the 2 stranded rows.
        const strandedPool = POOL_CARDS - 2;
        await expect(page.getByText(poolTotalLabel(strandedPool), { exact: true })).toBeVisible();
        expect(POOL_QUESTIONS - 2).not.toBe(strandedPool);

        // Every remaining card is new: both reviewed questions left the pool, and
        // the two stranded rows were absorbed into nothing.
        await expect(page.getByText('53(100%)', { exact: true })).toBeVisible();

        // The disclosure. The count is right, the condition is named rather than a
        // guessed cause (an archived question still exists), and the sentence says
        // the counts above are unaffected.
        await expect(
            page.getByText(
                '2 schedules sit outside the active card pool and are excluded from the counts above.',
                { exact: true },
            ),
        ).toBeVisible();

        // The overview splits the same way: the reviews happened, so the historical
        // figure still counts them, while no current card carries that history any
        // more. This is the label/scope pair the narrowed number is allowed to ship
        // with, asserted end to end.
        await expect(page.getByText('0 active cards with history', { exact: true })).toBeVisible();
    });
});
