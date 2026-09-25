# src/features/quiz/ — Assessment Engine & Live Study Sessions

## Purpose

Live quiz execution and assessment feature module. Owns active test-taking sessions, 5-type question rendering, real-time progress tracking, atomic submission evaluation dispatches, and quiz tree navigation.

## Ownership

| Path | Responsibility |
|---|---|
| `QuizScreen.tsx` | Feature-root screen orchestrator. Manages quiz launch requests (exam vs practice mode, single quiz vs virtual composite), wraps session flow, and handles completion transitions. |
| `components/` | Presentational views: `QuestionRenderer` (MC, MS, TF, Identification, FillBlank), `QuizStartView`, `QuizView`, `QuizResultView`, `QuestionSkeleton`. `IdentificationQuestion` renders the shared `<Input>` with the question prompt as its label (no hand-wired `useId`/`htmlFor`); `FillBlankQuestion` deliberately keeps raw inline `<input>`s because each blank sits inside a sentence template where field chrome would break the prose flow — it only tokenizes its border. |
| `hooks/session/` | Active session state machine hooks: `useQuizSessionFlow` (master orchestrator), `useQuizProgress` (index bounds & answer map), `useQuizPersistence` (start/submit/abandon dispatches), `useQuizLoader` (single quiz, virtual quiz composite, or material questions). |
| `hooks/queries/` | Read queries: `useQuestions`, `useQuizzes`. |
| `hooks/repositories/` | Context repository access adapters: `useQuestionRepository`, `useQuizRepository`. |
| `queries/` | Assessment query key factory (`assessmentQueryKeys.ts`). |
| `types/` | Feature contracts: `quizFeature.types.ts` (`QuizLaunchRequest`). |
| `utils/` | `quizBadgeAppearance.ts` — the semantic badge palette shared by every quiz surface (runner, authoring canvas, question bank, AI generator): `QUESTION_TYPE_APPEARANCE` typed `Record<QuestionType, {bg,fg}>` for exhaustiveness, plus `DIFFICULTY_APPEARANCE` and `POINTS_APPEARANCE`, all expressed as `var(--color-badge-*)` / role-token references. The literals live in `src/shared/theme/lunaclairTheme.ts`, never here. |

## Local Contracts

- **Feature-Root Screen Orchestrator**: `QuizScreen.tsx` sits at the feature root as the primary route-level screen for active quiz sessions.
- **Session State Machine Invariants**:
  - `useQuizSessionFlow` manages phase transitions: `loading` $\rightarrow$ `ready` $\rightarrow$ `completed`.
  - The material overview may resolve a provisional first quiz for its selection cards, but persisted session creation begins only after explicit Start/selection (`isSessionActive`).
  - Answers recorded during progress are held in an in-memory `Map<string, QuestionAnswerPayload>` preserved across forward/backward question navigation.
  - Retake resets progress and initializes a fresh active session.
- **Quiz picker test contract:** each quiz card exposes its stable `data-quiz-id`; acceptance tests scope the Start button to the card by accessible heading rather than walking arbitrary ancestors.
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
