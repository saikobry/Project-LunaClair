# src/features/analytics/ — Analytics & Learning Insights Feature
 
## Purpose

Provides learning insights, performance telemetry, spaced-repetition retention metrics, and activity visualization across user study sessions.

## Ownership

- **This feature owns no route screen and no root screen file (ADR-014).** The `/analytics` route is `src/app/screens/analytics/AnalyticsScreen.tsx` (registered in `ShellRoutes.tsx`), which composes this feature's components and `useGlobalAnalytics` directly. Everything this feature owns is under `queries/`, `hooks/`, and `components/` below.
- `queries/analyticsQueryKeys.ts` — Query key factory owning the `['analytics']` cache namespace.
- `hooks/queries/useGlobalAnalytics.ts` — Data hook querying `GetGlobalAnalyticsUseCase` via `ApplicationContext`.
- `components/` — Modular, lightweight, accessible UI visualizations (zero charting libraries):
  - `AnalyticsEmptyState.tsx` — Zero-data state for fresh installations.
  - `overview/OverviewMetricCards.tsx` — Study streak, global quiz accuracy, completed quizzes, and accumulated card reviews (with the pool-scoped `N active cards with history` subtext).
  - `retention/CardMaturityBar.tsx` — Stacked maturity distribution (`new`, `learning`, `review`, `mastered`) over the **projected card pool**, its "N total flashcards" label, and the orphan-schedule footnote.
  - `retention/ReviewForecastChart.tsx` — 7-day review load forecast with overdue cards collapsed into today.
  - `activity/ActivityHeatmap.tsx` — 52-week (365 days) activity calendar with honest labeling and intensity levels ($0\text{--}4$).

## Local Contracts

- Analytics components are strictly presentation-only — zero persistence logic, zero domain calculations inside UI components.
- Data fetching flows through `useGlobalAnalytics()` via `context.useCases.analytics.getGlobalAnalytics`.
- **"N total flashcards" is a CARD count, not a question count.** The breakdown's `totalCards` is the size of the projected card-key pool the domain builds from `questionToCards`, so a `fill_in_blank` question with three blanks contributes three, and a multiple-choice question contributes one. The label is honest because the number is the deck's own cardinality; never recompute or round it here.
- **`orphanReviewCount` is a diagnostic, never a bucket.** A review row whose card key is in no projected pool is reported as a footnote under the legend and is excluded from `totalCards` and from every bar segment, so the four buckets still sum to the total. Render it when it is non-zero and render nothing when it is zero — do not fold it into `newCount`, and do not let a non-zero count fail the screen. **The footnote names the condition, never one cause: "N schedule(s) sit(s) outside the active card pool".** Three real causes produce it and the list is open — the question was **deleted**, the question was **archived** (archiving is the app's soft delete, so the question still exists and only its cards left the pool), or a **cloze blank was retired**. Copy that asserts a single cause is wrong for the other two: an earlier "belongs to a card that no longer exists" told a user who merely archived a question that their card had been deleted. Any new presentation of this count inherits the same rule.
- **The overview's own figures are split by the question each answers, and the current-workload ones take the pool.** `cardsWithReviewHistory` counts **current** cards — keys in the active pool that have history — so it cannot disagree with the maturity bar sitting directly above it on the same screen. Its label says `active card(s) with history`; do not relabel it back to an unqualified "cards with history". `totalCardReviews`, the review-event and last-activity inputs, and the streak stay on **full** review history, orphans included: they describe what happened, not what exists, and an orphaned schedule was still reviewed. `computeStudyOverview(sessions, reviews, cardKeys, …)` therefore takes the same `cardKeys` set `computeCardMaturity` and `computeReviewForecast` receive, and `DexieAnalyticsRepository` passes one pool to all three. There is deliberately no separate all-time distinct-card figure — an unqualified one would silently include archived and removed cards.
- Analytics cache (`['analytics']`) is invalidated on quiz session completions (`useQuizPersistence`) and flashcard review recordings (`useFlashcardRating`). **Question writes and question deletions are invalidated at the app composition root, not from here or from `quiz-management`** — see `src/app/bootstrap/analyticsInvalidation.ts`; this feature keeps zero feature-to-feature dependencies.
- No charting libraries are used; all visualizations use lightweight, responsive StyleX-styled CSS/SVG structures.
- Direct-path import contract: `ShellRoutes` lazy-imports the app-layer screen (`screens/analytics/AnalyticsScreen`), which composes `features/analytics/hooks/queries/useGlobalAnalytics` and the feature's components by direct path. There is no `features/analytics/AnalyticsScreen` module to import.

## Work Guidance

- Ensure activity heatmap labels remain honest (`activeCardsCount` indicates cards with their latest recorded review on that day, not an append-only event log). The calendar is **historical and deliberately unscoped**: a review of a card that no longer exists still happened and is still counted, unlike the 7-day forecast, which is scoped to the pool of cards that still exist.
- Do not surface a diagnostic as an error state. `orphanReviewCount` is expected on pre-release data; the screen renders a footnote, never a failure.

## Verification

- `npm run test:run` — Unit, integration, and UI state tests (`components/retention/__tests__/CardMaturityBar.test.tsx`, and the app-layer `src/app/screens/analytics/__tests__/AnalyticsScreen.test.tsx`).
- `npm run test:e2e` — Real-Chromium acceptance: `tests/e2e/analytics/insights.spec.ts` covers the pool total against the fixture's cloze arithmetic, the stranded-schedule footnote (archived questions), the `N active cards with history` label, and the refresh after a question write that invalidates the analytics cache.
- `npm run build` — TypeScript compile and Vite production bundle.
- `npm run lint` — Oxlint static boundary analysis.

## Child DOX Index

No child AGENTS.md files.
