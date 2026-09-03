# src/features/quiz/ — Assessment Engine & Live Study Sessions

## Purpose

Live quiz execution and assessment feature module. Owns active test-taking sessions, 5-type question rendering, real-time progress tracking, atomic submission evaluation dispatches, and quiz tree navigation.

## Ownership

| Path | Responsibility |
|---|---|
| `QuizScreen.tsx` | Feature-root screen orchestrator. Manages quiz launch requests (exam vs practice mode, single quiz vs virtual composite), wraps session flow, and handles completion transitions. |
| `components/` | Presentational views: `QuestionRenderer` (MC, MS, TF, Identification, FillBlank), `QuizStartView`, `QuizView`, `QuizResultView`, `QuestionSkeleton`. |
| `components/SubjectQuizExplorer/` | Subject-scoped quiz hierarchy tree viewer (`SubjectQuizExplorer.tsx`) embedded into `catalog/subjects/components/SubjectQuizTab`. |
| `hooks/session/` | Active session state machine hooks: `useQuizSessionFlow` (master orchestrator), `useQuizProgress` (index bounds & answer map), `useQuizPersistence` (start/submit/abandon dispatches), `useQuizLoader` (single quiz, virtual quiz composite, or material questions). |
| `hooks/queries/` | Read queries: `useSubjectQuizTree`, `useQuizTreeSelection`, `useQuestions`, `useQuizzes`. |
| `hooks/repositories/` | Context repository access adapters: `useQuestionRepository`, `useQuizRepository`. |
| `queries/` | Assessment query key factory (`assessmentQueryKeys.ts`). |
| `types/` | Feature contracts: `quizFeature.types.ts` (`QuizLaunchRequest`), `quizTree.types.ts`. |

## Local Contracts

- **Feature-Root Screen Orchestrator**: `QuizScreen.tsx` sits at the feature root as the primary route-level screen for active quiz sessions.
- **Browsing vs Live Session Separation**:
  - `SubjectQuizExplorer` provides read-only hierarchy browsing and selection, emitting a `QuizLaunchRequest`.
  - `QuizScreen` provides the active session execution context (exam vs practice mode, timer, questions, and immediate/delayed feedback).
- **Session State Machine Invariants**:
  - `useQuizSessionFlow` manages phase transitions: `loading` $\rightarrow$ `ready` $\rightarrow$ `completed`.
  - Answers recorded during progress are held in an in-memory `Map<string, QuestionAnswerPayload>` preserved across forward/backward question navigation.
  - Retake resets progress and initializes a fresh active session.
- **Question Renderer Contract**:
  - 5 supported question types: `multiple_choice`, `multiple_select`, `true_false`, `identification`, `fill_in_blank`.
  - `QuestionRenderer` maps question type to its specialized view and emits typed payloads strictly via `onAnswer(payload: QuestionAnswerPayload)`.
- **Atomic Submission & Persistence**:
  - All quiz completions delegate to `SubmitQuizSessionUseCase`, atomically grading answers via domain scoring strategies and persisting `QuizScore` and `QuizSession`.
  - Session abandonment delegates to `AbandonQuizSessionUseCase`.
  - Session completion invalidates the `analyticsQueryKeys.all()` cache namespace to refresh mastery and activity charts.
- **Direct-Path Consumption (ADR-010)**:
  - Outside consumers import direct paths (e.g. `quiz/QuizScreen`, `quiz/types/quizFeature.types`, `quiz/queries/assessmentQueryKeys`). No root barrel is exposed.

## Work Guidance

- Colocate all unit/component/hook tests in `__tests__/` alongside the tested unit (ADR-012).
- Never evaluate scores or update session persistence directly in UI hooks; always route through `SubmitQuizSessionUseCase`.

## Verification

- `npm run test:run` — Runs all quiz session, renderer, loader, and hook tests.
- `npm run lint` — Validates Oxlint boundary guardrails.
- `npm run build` — Validates TypeScript and production bundling.
