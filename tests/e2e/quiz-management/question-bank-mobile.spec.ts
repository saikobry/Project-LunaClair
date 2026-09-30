import { test, expect } from '@playwright/test';
import { resetDatabase, setupApiMocks } from '../helpers/e2e-setup';
import { cloneShareToLibrary, routeShare } from '../helpers/share-seed';
import { cellStructure } from '../helpers/fixtures/cellStructure';

/**
 * End-to-end acceptance spec for the Question Bank mobile filter-panel branch.
 *
 * Below 769px, QuestionBankFilterBar relocates the tag facet into the collapsible
 * `mobileFilterPanel` behind the `Filter (N)` disclosure button. At desktop viewports
 * (>=769px), tags render on a dedicated standalone full-width row and the mobile
 * trigger is hidden.
 *
 * Seeding uses the live `/api/shares` clone flow with canonical fixture `cellStructure`.
 * Viewport is configured per-test via `page.setViewportSize(...)` (no Playwright config change).
 */

const FIRST_QUESTION_PROMPT =
  'Which organelle is responsible for generating ATP through aerobic cellular respiration?';
const NON_MITOCHONDRIA_PROMPT =
  'According to the Fluid Mosaic Model, what forms the structural matrix of the plasma membrane?';

test.describe('Question Bank Mobile Filter Panel E2E', () => {
  test('relocates the tag facet into the mobile disclosure panel below 769px without duplicating chips', async ({
    page,
  }) => {
    // 1. Mobile viewport (iPhone 12/13/14 portrait standard)
    await page.setViewportSize({ width: 390, height: 844 });

    // 2. Seed database and clone cellStructure directly into the Question Bank tab
    await resetDatabase(page);
    await setupApiMocks(page);
    await routeShare(page, cellStructure);
    await cloneShareToLibrary(page, cellStructure, 'questions');

    const filterTrigger = page.getByRole('button', { name: 'Toggle filters' });
    const tagGroupLandmark = page.getByRole('group', { name: 'Filter by tag' });

    // Wait for the question list to settle
    await expect(page.getByText(NON_MITOCHONDRIA_PROMPT)).toBeVisible();

    // Assertion 1: Standalone tag row is absent below the breakpoint when panel is closed
    await expect(tagGroupLandmark).toHaveCount(0);
    await expect(filterTrigger).toBeVisible();
    await expect(filterTrigger).toHaveText('Filter');

    // Assertion 5: Content is reachable directly under row 1 without scrolling past tags
    // Questions are sorted alphabetically by prompt, so the 'A...' prompt is the first card.
    await expect(page.getByText(NON_MITOCHONDRIA_PROMPT)).toBeInViewport();

    // Assertion 2: Opening the panel reveals the tag chips
    await filterTrigger.click();
    await expect(tagGroupLandmark).toBeVisible();

    // Assertion 3 (Duplication guard): Exactly one "Filter by tag" group landmark exists
    await expect(tagGroupLandmark).toHaveCount(1);

    // Assertion 4: Selecting a tag filters questions and updates trigger count badge
    const mitochondriaChip = tagGroupLandmark.getByRole('button', { name: 'mitochondria' });
    await expect(mitochondriaChip).toBeVisible();
    await mitochondriaChip.click();

    // Trigger label reflects the selected tag count
    await expect(filterTrigger).toHaveText(/Filter \(1\)/);

    // Question list narrows: matching question survives, non-matching question is filtered out
    await expect(page.getByText(FIRST_QUESTION_PROMPT)).toBeVisible();
    await expect(page.getByText(NON_MITOCHONDRIA_PROMPT)).toBeHidden();

    // Deselecting restores the unfiltered count and list
    await mitochondriaChip.click();
    await expect(filterTrigger).toHaveText('Filter');
    await expect(page.getByText(NON_MITOCHONDRIA_PROMPT)).toBeVisible();
  });

  test('preserves the desktop standalone tag row and hides the mobile filter trigger at desktop viewport', async ({
    page,
  }) => {
    // Default desktop viewport (1280x720 from playwright.config.ts)
    await resetDatabase(page);
    await setupApiMocks(page);
    await routeShare(page, cellStructure);
    await cloneShareToLibrary(page, cellStructure, 'questions');

    const filterTrigger = page.getByRole('button', { name: 'Toggle filters' });
    const tagGroupLandmark = page.getByRole('group', { name: 'Filter by tag' });

    // Assertion 6: At desktop viewport, the standalone tag row IS present and mobile trigger is hidden
    await expect(tagGroupLandmark).toHaveCount(1);
    await expect(tagGroupLandmark).toBeVisible();
    await expect(filterTrigger).toBeHidden();
  });
});
