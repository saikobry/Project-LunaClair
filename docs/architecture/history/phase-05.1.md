# Architecture Chronicle: Phase 5.1 — Assessment Experience Integration

**Project:** Project LunaClair  
**Studio:** Saiko Interactive  
**Phase:** 5.1 (Assessment Experience Integration)  
**Status:** Completed & Verified (100%)  

---

## 1. Executive Summary

Phase 5.1 bridges the Assessment Engine Foundation built in Phase 5 with LunaClair's user-facing application shell and UI screens. It connects the "brain" (IndexedDB storage, strategy grading, pure `AssessmentService`) to the "body" (lightweight `AppRoute` navigation, Library/Reader entry points, `QuizScreen` state machine, interactive `QuizView` player, and post-session `QuizResultView`).

### Key Architectural Wins:
1. **Lightweight App Shell Routing**: Replaced basic screen switching in `AppShell.tsx` with a strongly typed `AppRoute` router supporting `'library'`, `'reader'`, and `'quiz'` screens with `QuizLaunchRequest` parameters.
2. **UI Entry Points**: Added "Start Quiz" action buttons on Study Library material cards and a "Take Quiz" button in the Reader header toolbar.
3. **Modular Sub-Hook Architecture**: Structured quiz session flow into 4 specialized sub-hooks (`useQuizLoader`, `useQuizProgress`, `useQuizSubmission`, `useQuizPersistence`) orchestrated cleanly by `useQuizSessionFlow`.
4. **Predictable Flow State Machine**: Introduced `QuizFlowState` (`'loading' | 'empty' | 'ready' | 'completed' | 'error'`) inside `QuizScreen` to make state rendering explicit and audit-proof.
5. **Zero-UI-Grading Enforcement**: Kept interactive question rendering and UI views completely pure; all evaluation, scoring, and atomic IndexedDB persistence delegate exclusively to `AssessmentService` and domain repositories.

---

## 2. Files Changed Breakdown

### Added Files

#### Quiz Feature (`src/features/quiz/`)
- `types/quizFeature.types.ts`: Defines `QuizLaunchRequest` (`materialId`, `quizId?`, `source`, `mode`) and `QuizFlowState` discriminated union.
- `hooks/useQuizLoader.ts`: Async loader fetching questions and quiz definitions for the requested material.
- `hooks/useQuizProgress.ts`: Manages active question indexing, draft answers map, and Practice/Exam mode feedback rules.
- `hooks/useQuizSubmission.ts`: Invokes `AssessmentService.evaluateSession()` and commits completed sessions atomically via `useSessionMutations`.
- `hooks/useQuizPersistence.ts`: Manages explicit session creation (`status: 'in_progress'`), background auto-save, and resumption.
- `hooks/useQuizSessionFlow.ts`: Orchestrator hook composing the 4 modular sub-hooks into a clean `QuizFlowState`.
- `components/QuizView.tsx`: Interactive quiz player UI rendering progress headers, `QuestionRenderer` inputs, mode-based feedback, and navigation buttons.
- `components/QuizResultView.tsx`: Post-session summary UI displaying `QuizScore` metrics, answer review lists, explanations, and retake actions.
- `QuizScreen.tsx`: Top-level feature screen handling `QuizFlowState` rendering dispatch (`loading`, `empty`, `ready`, `completed`, `error`).

### Modified Files

#### App Shell (`src/app/layouts/`)
- `AppShell.tsx`: Expanded navigation routing to `AppRoute` union and rendered `QuizScreen` on launch requests.

#### Features (`src/features/`)
- `library/components/MaterialCard.tsx`, `MaterialGrid.tsx`, `LibraryView.tsx`, `LibraryScreen.tsx`: Added "Start Quiz" action button to material cards.
- `reader/ReaderScreen.tsx`: Added "Take Quiz" action button to the top header bar.
- `quiz/index.ts`: Re-exported `QuizScreen` and `QuizLaunchRequest` as public feature API.
- `domain/quiz/QuizSession.ts`: Added `QuizSessionStatus` domain type (`'draft' | 'in_progress' | 'completed' | 'abandoned'`).

---

## 3. Component & Layer Architecture

```text
AppShell Layout (AppRoute state)
  ├── LibraryScreen ("Start Quiz" button)
  ├── ReaderScreen ("Take Quiz" toolbar button)
  └── QuizScreen (State Machine: QuizFlowState ['loading'|'ready'|'completed'|'error'])
        ↓
Quiz Feature Orchestration
  └── useQuizSessionFlow
        ├── useQuizLoader (Fetches Quiz & Question entities)
        ├── useQuizProgress (Draft answers, active index, QuizMode rules)
        ├── useQuizSubmission (Evaluates QuizScore via AssessmentService)
        └── useQuizPersistence (Auto-saves & resumes in_progress sessions)
        ↓
Pure Domain & Infrastructure
  ├── AssessmentService (Pure strategy validation & scoring)
  └── QuizSessionRepository (Atomic Dexie IndexedDB session commits)
        ↓
Interactive UI Presentation
  ├── QuizView (Header progress, QuestionRenderer container, Next/Submit controls)
  └── QuizResultView (QuizScore breakdown, Question review list, Retake actions)
```

---

## 4. Core Domain & Data Resolution

- **Quiz Launch Contract (`QuizLaunchRequest`)**: Entry points specify `materialId`, `quizId`, `source` (`'library'` | `'reader'`), and `mode` (`'practice'` | `'exam'`), encapsulating launch parameters cleanly.
- **Explicit Session Lifecycle (`QuizSessionStatus`)**: Sessions start with status `'in_progress'`, auto-save draft states, and transition atomically to `'completed'` upon submission.
- **Pure Evaluation & Snapshot Persistence**: When a session completes, `AssessmentService.evaluateSession()` evaluates draft answers and returns `QuizScore`. The session snapshot is written atomically to `lunaclair-db` with embedded `questionSnapshots`.

---

## 5. Asset & Storage Organization

- **Static Markdown Materials**: Reside in `public/materials/{sourceId}/index.md`.
- **IndexedDB Session Storage**: Quiz sessions and draft answers are persisted in IndexedDB (`lunaclair-db` table `quizSessions`).
- **Synchronous App Routing**: `AppShell` routes active screens in memory without main-thread blocking.

---

## 6. Migration Strategy

- No schema migrations required for Phase 5.1 (builds directly upon Dexie Version 1 schema established in Phase 5).
- Compatible with all existing materials and question banks in IndexedDB.

---

## 7. Error Handling & Guarding Strategy

- **Empty Question Bank Guard**: If a material has no questions, `QuizScreen` transitions cleanly to `QuizFlowState.empty` ("No questions available for this material yet").
- **Unsaved Progress Warning**: Exiting an `in_progress` quiz prompts confirmation while preserving draft answers in IndexedDB.
- **Compilation Safety**: Discriminated unions (`QuizFlowState`, `AppRoute`, `QuestionAnswerPayload`) ensure exhaustiveness checks during build.

---

## 8. End-to-End Data Flow

```text
[User Clicks "Start Quiz" on Material Card]
       │
       ▼
[AppShell.handleStartQuiz(launchRequest)] → Sets AppRoute to { name: 'quiz', launchRequest }
       │
       ▼
[QuizScreen renders useQuizSessionFlow(launchRequest)]
       │
       ▼
[useQuizLoader & useQuizPersistence] → Initializes/resumes session in IndexedDB
       │
       ▼
[QuizScreen displays QuizView + QuestionRenderer] → User submits answers
       │
       ▼
[useQuizSubmission.submitQuiz()]
       │
       ▼
[AssessmentService.evaluateSession()] → Computes QuizScore & QuizResult
       │
       ▼
[QuizSessionRepository.completeSession()] → Atomic Dexie transaction commits session with questionSnapshots
       │
       ▼
[QuizScreen transitions to QuizFlowState.completed] → Renders QuizResultView
```

---

## 9. Deprecated / Removed Architecture

- Monolithic single-hook state replaced by modular sub-hooks (`useQuizLoader`, `useQuizProgress`, `useQuizSubmission`, `useQuizPersistence`).
- Inline screen switching replaced by typed `AppRoute` union.

---

## 10. Verification & Quality Assurance

- **Build Check (`npm run build`)**: Passed cleanly. Compiled 2284 modules with `tsc -b` and created Vite production bundle with **0 type errors**.
- **Linter Check (`npm run lint`)**: Passed cleanly with **0 warnings and 0 errors** across 160 files inspected by `oxlint`.

---

## 11. Full System Architecture Overview

```text
src/
├── app/            — App shell layout, lightweight routing, DI context, providers
├── domain/         — Business domain models (quiz, reader, library), strategies, AssessmentService
├── infrastructure/ — Database layer (LunaClairDatabase, Dexie repositories, schema v1)
├── features/       — Feature modules:
│   ├── library/    — Material grid, CRUD modals, "Start Quiz" entry point
│   ├── reader/     — Markdown viewer, highlights, drawings, "Take Quiz" toolbar button
│   └── quiz/       — QuizScreen orchestrator, modular session hooks, QuizView, QuizResultView, QuestionRenderer
└── shared/         — Shared UI primitives, design tokens, constants, utilities
```

---

## 12. Final Assessment & Next Phase Readiness

- **Status**: **100% Complete & Production-Ready**.
- **Technical Debt**: None.
- **Next Phase Readiness**: LunaClair is fully integrated and ready for **Phase 6 (Flashcards & Spaced Repetition)** or **Progress Analytics**, leveraging saved `QuizSession` history and IndexedDB repositories.
