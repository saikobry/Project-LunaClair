# src/features/analytics/ — Analytics & Learning Insights Feature
 
## Purpose

Provides learning insights, performance telemetry, spaced-repetition retention metrics, and activity visualization across user study sessions.

## Ownership

- `AnalyticsScreen.tsx` — Top-level screen orchestrator rendered at `/analytics` via `ShellRoutes.tsx`.
- `queries/analyticsQueryKeys.ts` — Query key factory owning the `['analytics']` cache namespace.
- `hooks/queries/useGlobalAnalytics.ts` — Data hook querying `GetGlobalAnalyticsUseCase` via `ApplicationContext`.
- `components/` — Modular, lightweight, accessible UI visualizations (zero charting libraries):
  - `AnalyticsEmptyState.tsx` — Zero-data state for fresh installations.
  - `overview/OverviewMetricCards.tsx` — Study streak, global quiz accuracy, completed quizzes, and accumulated card reviews.
  - `retention/CardMaturityBar.tsx` — Stacked maturity distribution (`new`, `learning`, `review`, `mastered`).
  - `retention/ReviewForecastChart.tsx` — 7-day review load forecast with overdue cards collapsed into today.
  - `activity/ActivityHeatmap.tsx` — 52-week (365 days) activity calendar with honest labeling and intensity levels ($0\text{--}4$).

## Local Contracts

- Analytics components are strictly presentation-only — zero persistence logic, zero domain calculations inside UI components.
- Data fetching flows through `useGlobalAnalytics()` via `context.useCases.analytics.getGlobalAnalytics`.
- Analytics cache (`['analytics']`) is invalidated on quiz session completions (`useQuizPersistence`) and flashcard review recordings (`useFlashcardRating`).
- No charting libraries are used; all visualizations use lightweight, responsive StyleX-styled CSS/SVG structures.
- Direct-path import contract: `ShellRoutes` consumes `features/analytics/AnalyticsScreen` directly.

## Work Guidance

- Ensure activity heatmap labels remain honest (`activeCardsCount` indicates cards with their latest recorded review on that day, not an append-only event log).

## Verification

- `npm run test:run` — Unit, integration, and UI state tests (`src/features/analytics/__tests__/AnalyticsScreen.test.tsx`).
- `npm run build` — TypeScript compile and Vite production bundle.
- `npm run lint` — Oxlint static boundary analysis.

## Child DOX Index

No child AGENTS.md files.
