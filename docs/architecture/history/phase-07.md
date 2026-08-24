# Phase 7 Chronicle — Analytics & Learning Insights

## 1. Executive Summary

- **Status:** Complete (100% of Phase 7 scope delivered, integrated, and verified).
- **Core Objective:** Deliver a dedicated, local-first analytics capability for Project LunaClair that derives deep learning telemetry directly from existing learning events (`quizSessions` and `flashcardReviews`) without stateful duplication or heavy charting libraries.
- **Key Wins:**
  - **Pure Domain Calculation Engines:** Established pure, deterministic calculation engines (`overviewEngine`, `retentionEngine`, `masteryEngine`, `activityEngine`, `streakEngine`, `dateUtils`) with zero side effects and zero external dependencies.
  - **Semantically Honest Telemetry:** Enforced question-weighted global quiz accuracy, consecutive calendar streak evaluation with grace periods, mutually exclusive card maturity partitioning (`newCount + learningCount + reviewCount + masteredCount === totalCards`), 7-day review forecast with overdue collapsing, and 52-week activity mapping.
  - **Zero-N+1 Concurrent Data Retrieval:** Designed `DexieAnalyticsRepository` using concurrent IndexedDB queries (`Promise.all`) across tables, delegating 100% of analytical calculations to pure domain engines.
  - **Framework-Agnostic Application Layer:** Added `GetGlobalAnalyticsUseCase`, `GetSubjectAnalyticsUseCase`, and `GetMaterialAnalyticsUseCase` wired into the application composition root.
  - **Lightweight Responsive Presentation:** Built `/analytics` dashboard hub (`Insights` in sidebar) composing KPI cards, card maturity stacked bar, SVG review forecast chart, subject mastery matrix with strengths and weaknesses, and 52-week activity heatmap.
  - **Automatic Query Invalidation:** Automated query cache invalidation on quiz session completion and flashcard review mutations.
  - **100% Test Pass Rate:** Verified through 21 Vitest test suites (138 tests) + 10 Playwright Chromium E2E acceptance tests.

---

## 2. Files Changed Breakdown

### Added
- `src/domain/analytics/` — Pure learning analytics domain:
  - `analytics.types.ts` — Canonical domain view models (`StudyOverviewMetrics`, `CardMaturityBreakdown`, `ReviewForecastDay`, `TopicMastery`, `SubjectMastery`, `ActivityDay`, `GlobalAnalytics`, `MaterialAnalytics`).
  - `AnalyticsRepository.ts` — Domain port interface for global, subject, and material analytics aggregation.
  - `dateUtils.ts` — Timezone-aware date parsing, calendar window generators, and local date key formatting.
  - `streakEngine.ts` — Consecutive calendar streak evaluation with today/yesterday grace periods and historical maximum calculation.
  - `activityEngine.ts` — 365-day (52-week) volume activity calendar generator with discrete intensity levels ($0\text{--}4$).
  - `masteryEngine.ts` — Topic and subject mastery calculations with difficulty multipliers ($1.0, 1.5, 2.0$), attempt counting, and deterministic strengths/weaknesses ranking.
  - `retentionEngine.ts` — Mutually exclusive card maturity partitioning and 7-day review forecast with overdue collapsing.
  - `overviewEngine.ts` — Global overview metrics calculation (question-weighted accuracy, total reviews, streaks).
  - `__tests__/` — 6 unit test suites (`dateUtils.test.ts`, `streakEngine.test.ts`, `activityEngine.test.ts`, `masteryEngine.test.ts`, `retentionEngine.test.ts`, `overviewEngine.test.ts`).
- `src/infrastructure/database/repositories/` — Persistence layer:
  - `DexieAnalyticsRepository.ts` — Multi-table IndexedDB query adapter delegating calculations to pure domain engines.
  - `DexieAnalyticsRepository.test.ts` — Real IndexedDB integration tests (via `fake-indexeddb`).
  - `analytics-data-access.test.ts` — Data access foundation integration tests.
- `src/application/use-cases/analytics/` — Application orchestration:
  - `GetGlobalAnalyticsUseCase.ts` — Application use case for system-wide study telemetry.
  - `GetSubjectAnalyticsUseCase.ts` — Application use case for subject-level mastery telemetry.
  - `GetMaterialAnalyticsUseCase.ts` — Application use case for material-level performance telemetry.
  - `__tests__/analyticsUseCases.test.ts` — Use-case delegation and input guard unit tests.
- `src/features/analytics/` — User interface and visualizations:
  - `AnalyticsScreen.tsx` — Top-level screen orchestrator rendered at `/analytics`.
  - `queries/analyticsQueryKeys.ts` — Query key factory owning `['analytics']` cache namespace.
  - `hooks/queries/useGlobalAnalytics.ts` — TanStack Query data hook querying `GetGlobalAnalyticsUseCase`.
  - `components/AnalyticsEmptyState.tsx` — Zero-data state for fresh installations.
  - `components/overview/OverviewMetricCards.tsx` — 4 KPI summary cards (Streak, Accuracy, Quizzes, Card Reviews).
  - `components/retention/CardMaturityBar.tsx` — Stacked horizontal progress bar showing card maturity buckets.
  - `components/retention/ReviewForecastChart.tsx` — Lightweight SVG 7-day review workload bar chart.
  - `components/mastery/SubjectMasteryCard.tsx` & `SubjectMasteryGrid.tsx` — Subject proficiency progress, strengths/weaknesses badges, and topic lists.
  - `components/activity/ActivityHeatmap.tsx` — 52-week activity heatmap with horizontal scrolling and honest labeling.
  - `tests/AnalyticsScreen.test.tsx` — UI state and component test suite.
  - `AGENTS.md` — Domain contracts, ownership, and verification rules for analytics.

### Modified
- `src/domain/quiz/QuizSessionRepository.ts` & `DexieQuizSessionRepository.ts` — Added `getAllCompletedSessions(signal?: AbortSignal)`.
- `src/domain/flashcards/FlashcardReviewRepository.ts` & `DexieFlashcardReviewRepository.ts` — Added `getAllReviews(signal?: AbortSignal)`.
- `src/application/index.ts` — Exported analytics use cases.
- `src/app/bootstrap/createRepositories.ts` — Registered `dexieAnalyticsRepository`.
- `src/app/bootstrap/createUseCases.ts` — Registered `analytics` use cases group.
- `src/app/layouts/routing.ts` — Added `/analytics` route (`{ kind: 'analytics' }`).
- `src/app/layouts/ShellRoutes.tsx` — Added route branch rendering `<AnalyticsScreen />`.
- `src/app/layouts/AppSidebar/AppSidebar.tsx` & `AppShell.tsx` — Added **Insights** (`TrendingUp`) navigation item.
- `src/features/quiz/hooks/session/useQuizPersistence.ts` — Added analytics query cache invalidation on quiz session completion.
- `src/features/flashcards/hooks/mutations/useFlashcardRating.ts` — Added analytics query cache invalidation on flashcard review.
- `AGENTS.md`, `src/domain/AGENTS.md`, `src/application/AGENTS.md`, `src/infrastructure/AGENTS.md`, `src/features/AGENTS.md` — Synchronized DOX hierarchy.

---

## 3. Component & Layer Architecture

```text
AppSidebar / ShellRoutes (/analytics)
                │
         AnalyticsScreen
   ┌────────────┼────────────┬─────────────┬──────────────┐
   ▼            ▼            ▼             ▼              ▼
MetricCards  MaturityBar  ForecastChart ActivityHeatmap MasteryGrid
   │
useGlobalAnalytics (TanStack Query: ['analytics', 'global'])
   │
GetGlobalAnalyticsUseCase (Application Layer)
   │
AnalyticsRepository (Domain Port)
   │
DexieAnalyticsRepository (Infrastructure Layer)
   ├── db.quizSessions (status === 'completed')
   ├── db.flashcardReviews
   ├── db.questions
   ├── db.materials
   └── db.subjects
        │ (Concurrent retrieval via Promise.all)
        ▼
Pure Domain Engines (src/domain/analytics/)
  ├── computeStudyOverview()
  ├── computeCardMaturity()
  ├── computeReviewForecast()
  ├── computeSubjectMasteries()
  └── buildActivityCalendar()
```

---

## 4. Core Domain & Data Resolution

### Immutable Learning Data as Sole Source of Truth
LunaClair's analytics avoids duplicating state into auxiliary summary tables. All metrics are calculated deterministically on demand from canonical entities:
1. **Quiz Sessions (`QuizSession`):**
   - Historical quiz attribution is resolved strictly from immutable `questionSnapshots[answer.questionId].materialId` $\rightarrow$ `StudyMaterial.subjectId` $\rightarrow$ `Subject`.
   - Virtual multi-subject quizzes are attributed accurately to their respective subjects without mutating database records.
2. **Flashcard Reviews (`ReviewState`):**
   - Represents current card scheduling state (`repetitions`, `easeFactor`, `intervalDays`, `lapses`, `dueAt`, `lastReviewedAt`, `reviewCount`).
   - `totalCardReviews` is aggregated as $\sum \text{reviewCount}$.
   - Card maturity is strictly partitioned:
     - *New:* `reviewCount === 0` (including unpersisted cards).
     - *Learning:* `reviewCount > 0 && intervalDays < 7`.
     - *Review:* `(7 <= intervalDays < 21) || (intervalDays >= 21 && lapses > 1)`.
     - *Mastered:* `intervalDays >= 21 && lapses <= 1`.
     - *Invariant:* $\text{new} + \text{learning} + \text{review} + \text{mastered} \equiv \text{totalCards}$.
3. **Difficulty Weighting & Topic Mastery:**
   - Multipliers: Easy $= 1.0$, Medium $= 1.5$, Hard $= 2.0$.
   - Scored on answer attempts (`attemptCount`), not unique questions.
   - Statuses: `unattempted`, `needs_practice` ($< 70\%$), `proficient` ($70\text{--}84.99\%$ or $\ge 85\%$ with $< 3$ attempts), `mastered` ($\ge 85\%$ weighted score **AND** $\ge 3$ attempts).

---

## 5. Asset & Storage Organization

- Analytics requires zero new database stores or schema migrations. It reads from existing IndexedDB tables (`quizSessions`, `flashcardReviews`, `questions`, `materials`, `subjects`).
- Visualizations are built with native React, StyleX, and semantic SVG elements, adding zero runtime bundle bloat and requiring no charting dependencies.

---

## 6. Migration Strategy

- **Zero Database Migrations:** Dexie schema remains at version 8.
- **Backward Compatibility:** Safe fallbacks are provided for historical sessions where `questionSnapshots` might be sparsely populated.

---

## 7. Error Handling & Guarding Strategy

- **Empty / Zero-Data Handling:** Fresh installations with no completed quizzes and no card reviews render a dedicated `AnalyticsEmptyState` rather than empty graphs or awkward 0% labels.
- **Query Abort Signals:** All repository queries accept `AbortSignal` and check `signal.aborted` to prevent unmounted component race conditions.
- **Division-by-Zero Protection:** All calculations (`globalQuizAccuracy`, `rawAccuracy`, `weightedScore`, `percentages`) guard against zero denominators and default to 0.

---

## 8. End-to-End Data Flow

```text
User navigates to /analytics
      │
AnalyticsScreen mounts
      │
useGlobalAnalytics() executes query ['analytics', 'global']
      │
GetGlobalAnalyticsUseCase.execute()
      │
DexieAnalyticsRepository.getGlobalAnalytics()
      │
Promise.all([db.quizSessions, db.flashcardReviews, db.questions, db.materials, db.subjects])
      │
Domain Engines execute calculations (Overview, Maturity, Forecast, Mastery, Activity)
      │
Returns GlobalAnalytics DTO
      │
AnalyticsScreen renders OverviewMetricCards, CardMaturityBar, ReviewForecastChart, ActivityHeatmap, SubjectMasteryGrid
      │
User completes a quiz or reviews a flashcard
      │
Mutation onSuccess calls queryClient.invalidateQueries(['analytics'])
      │
Dashboard automatically refetches and refreshes insights
```

---

## 9. Deprecated / Removed Architecture

- Removed legacy assumptions that review logs are append-only; clarified that `flashcardReviews` stores current state per card.
- Cleaned unused imports and symbols across components.

---

## 10. Verification & Quality Assurance

- **Vitest Suites:** `npm run test:run` — **21 / 21 test suites passed (138 / 138 tests, 100% pass rate)**.
- **Playwright E2E:** `npm run test:e2e` — **10 / 10 Playwright tests passed**.
- **Static Analysis:** `npm run lint` — **0 errors, 0 warnings**.
- **Production Build:** `npm run build` — `tsc -b` and Vite build succeeded cleanly.

---

## 11. Full System Architecture Overview

```text
src/
├── app/
│   ├── bootstrap/        (createRepositories, createUseCases, DI graph)
│   ├── layouts/          (AppShell, AppSidebar, ShellRoutes, routing)
│   └── providers/        (ApplicationContext, FocusModeContext, ToastContext)
├── application/
│   ├── use-cases/analytics/ (GetGlobalAnalytics, GetSubjectAnalytics, GetMaterialAnalytics)
│   └── use-cases/        (quiz, quiz-management, library, subject, reader, content, flashcards)
├── domain/
│   ├── analytics/        (analytics.types, dateUtils, streakEngine, activityEngine, masteryEngine, retentionEngine, overviewEngine, AnalyticsRepository)
│   ├── quiz/             (Question, Quiz, QuizSession, AssessmentService, repositories)
│   ├── flashcards/       (scheduler, flashcardToCard, FlashcardReviewRepository)
│   ├── library/          (StudyMaterial, Subject, Term, SubjectTerm, repositories)
│   └── reader/           (Document, annotations, repositories)
├── infrastructure/
│   ├── database/         (Dexie database, schema v8, repositories: DexieAnalyticsRepository, etc.)
│   └── api/              (ApiCatalogRepository, HybridDocumentRepository, Worker adapters)
├── features/
│   ├── analytics/        (AnalyticsScreen, OverviewMetricCards, CardMaturityBar, ReviewForecastChart, SubjectMasteryGrid, ActivityHeatmap)
│   ├── catalog/          (Library, subjects, terms, available catalog, import/preview)
│   ├── reader/           (Markdown viewer, TOC, annotations)
│   ├── quiz/             (QuizScreen, player, results, SubjectQuizExplorer)
│   ├── quiz-management/  (Question Bank, Quiz Catalog, editors, canvas)
│   ├── flashcards/       (FlashcardScreen, 3D flip card player)
│   └── writer/           (Lexical WYSIWYG editor, Markdown transformers)
├── shared/               (UI primitives, hooks, utilities)
└── styles/               (Global tokens, master stylesheet)
```

---

## 12. Final Assessment & Next Phase Readiness

- **Production Readiness:** Phase 7 is 100% complete, fully tested, and verified.
- **Technical Debt:** Zero outstanding lints or type errors.
- **Next Phase:** The system is ready for **Phase 8 (AI Study Assistant & Content Generation)**.
