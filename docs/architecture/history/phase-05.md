# Architecture Chronicle: Phase 5 — Assessment Engine Foundation

**Project:** Project LunaClair  
**Studio:** Saiko Interactive  
**Phase:** 5 (Assessment Engine Foundation)  
**Status:** Completed & Verified (100%)  

---

## 1. Executive Summary

Phase 5 transforms LunaClair from a document reader into an extensible, interactive learning platform by establishing the core **Assessment Engine**. 

### Key Architectural Wins:
1. **IndexedDB Infrastructure Adoption**: Replaced raw `localStorage` persistence with a structured local document database (`lunaclair-db` via **Dexie.js**) housed cleanly under `src/infrastructure/database/`.
2. **Pure Strategy-Based Assessment Behavior**: Implemented the Strategy Pattern via `QuestionStrategyResolver` for question validation and grading across 5 distinct question types (`multiple_choice`, `multiple_select`, `true_false`, `identification`, `fill_in_blank`).
3. **Pure Assessment Application Service**: Created `AssessmentService` as a pure, zero-side-effect domain service that calculates `QuizResult` and `QuizScore` without direct storage or network dependencies.
4. **Immutable Quiz Attempt History**: Implemented `questionSnapshots` inside `QuizSession`, ensuring historical quiz attempts and scores remain completely immutable even if question bank items are edited or deleted in the future.
5. **Dependency Injection & Async State Management**: Extended `RepositoryProvider` and TanStack Query integration (`assessmentQueryKeys`) for all assessment entities (`Question`, `Quiz`, `QuizSession`).
6. **Centralized Question UI Rendering**: Created a clean `QuestionRenderer` component using React component composition to render type-specific interactive input views.

---

## 2. Files Changed Breakdown

### Added Files

#### Infrastructure (`src/infrastructure/database/`)
- `schema.ts`: Defines Version 1 Dexie schema for object stores (`materials`, `questions`, `quizzes`, `quizSessions`, `highlights`, `drawings`, `preferences`, `metadata`).
- `LunaClairDatabase.ts`: Custom `Dexie` subclass defining strongly-typed table properties.
- `DatabaseMigrator.ts`: Handles database versioning and migrates legacy `localStorage` materials and annotations into IndexedDB on first run.
- `DatabaseSeeder.ts`: Provides sample content seeding (`seedIfEmpty()`) covering all 5 question types for the default material.
- `DatabaseInitializer.ts`: Startup orchestrator initializing database connection, migration, and seeder.
- `repositories/DexieQuestionRepository.ts`: Implements `QuestionRepository` using indexed Dexie queries.
- `repositories/DexieQuizRepository.ts`: Implements `QuizRepository` using indexed Dexie queries.
- `repositories/DexieQuizSessionRepository.ts`: Implements `QuizSessionRepository` using Dexie multi-store transactions.
- `repositories/DexieLibraryRepository.ts`: Implements `LibraryRepository` backed by IndexedDB.
- `repositories/DexieAnnotationRepository.ts`: Implements `AnnotationRepository` backed by IndexedDB.

#### Domain (`src/domain/quiz/`)
- `QuestionType.ts`: Enum/union defining supported question types (`multiple_choice`, `multiple_select`, `true_false`, `identification`, `fill_in_blank`).
- `QuizMode.ts`: Enum/union defining quiz modes (`practice`, `timed`, `review`, `exam`).
- `AnswerPayload.ts`: Discriminated union `QuestionAnswerPayload` and specific payload types.
- `Question.ts`: Domain `Question` interface with `version` tracking.
- `Quiz.ts`: Domain `Quiz` definition model.
- `Answer.ts`: Domain `SubmittedAnswer` model.
- `QuizSession.ts`: Domain `QuizSession` model with `questionSnapshots` and `QuizScore` metrics.
- `QuestionRepository.ts`, `QuizRepository.ts`, `QuizSessionRepository.ts`: Async contract interfaces.
- `strategies/QuestionStrategy.ts`: Interface for strategy validation and grading.
- `strategies/MultipleChoiceStrategy.ts`: Strategy for single-choice questions.
- `strategies/MultipleSelectStrategy.ts`: Strategy for multi-choice checkbox questions.
- `strategies/TrueFalseStrategy.ts`: Strategy for boolean questions.
- `strategies/IdentificationStrategy.ts`: Strategy for identification text matching.
- `strategies/FillBlankStrategy.ts`: Strategy for template fill-in-the-blank questions.
- `strategies/QuestionStrategyResolver.ts`: Strategy resolver mapping `QuestionType` to strategy implementations.
- `AssessmentService.ts`: Pure domain service for grading and evaluation.

#### Feature (`src/features/quiz/`)
- `queries/assessmentQueryKeys.ts`: TanStack Query key factory (`assessment.questions`, `assessment.quizzes`, `assessment.sessions`).
- `hooks/useQuestionRepository.ts`, `useQuizRepository.ts`, `useQuizSessionRepository.ts`: Dependency injection hooks.
- `hooks/useQuestions.ts`, `useQuizzes.ts`, `useQuizSessions.ts`: TanStack query hooks.
- `hooks/mutations/useQuestionMutations.ts`, `useQuizMutations.ts`, `useSessionMutations.ts`: TanStack mutation hooks.
- `components/QuestionRenderer.tsx`: Central switcher component for question UI rendering.
- `components/MultipleChoiceQuestion.tsx`, `MultipleSelectQuestion.tsx`, `TrueFalseQuestion.tsx`, `IdentificationQuestion.tsx`, `FillBlankQuestion.tsx`: Component renderers for each question type.

---

## 3. Component & Layer Architecture

```text
React UI Layer
  ├── QuestionRenderer & Question Components
  └── Feature Views (Library, Reader, Quiz)
        ↓
Feature Hooks Layer (TanStack Query)
  ├── Queries (useQuestions, useQuizzes, useQuizSessions)
  └── Mutations (useQuestionMutations, useQuizMutations, useSessionMutations)
        ↓
Domain & Application Layer
  ├── AssessmentService (Pure Domain Execution & Strategy Grading)
  ├── QuestionStrategyResolver → Question Strategies
  └── Repository Interfaces (DI Ports via RepositoryProvider)
        ↓
Infrastructure Persistence Layer
  ├── Dexie Repositories (DexieQuestionRepository, DexieQuizSessionRepository, etc.)
  └── LunaClairDatabase (src/infrastructure/database/)
        ↓
Browser Local Database
  └── IndexedDB (lunaclair-db: materials, questions, quizzes, quizSessions, highlights, drawings, preferences, metadata)
```

---

## 4. Core Domain & Data Resolution

- **Domain Port Isolation**: Features access repositories strictly through TypeScript interfaces (`QuestionRepository`, `QuizRepository`, `QuizSessionRepository`). Direct imports of Dexie or database classes in UI code are forbidden.
- **Pure Domain Engine**: `AssessmentService` evaluates user inputs against questions using strategy objects retrieved from `QuestionStrategyResolver`, generating a deterministic `QuizResult` containing `SubmittedAnswer` items and `QuizScore` metrics.
- **Immutable Historical Snapshots**: When a quiz session starts, a copy of the question entity state is embedded in `session.questionSnapshots`. Historical grading results remain preserved even if question definitions evolve in the question bank.

---

## 5. Asset & Storage Organization

- **Public Static Assets**: Document markdown and figure assets reside in `public/materials/{sourceId}/index.md` (e.g. `public/materials/anatomy-physiology/`).
- **IndexedDB Storage**: Application state (materials, questions, quizzes, sessions, annotations, preferences) resides in IndexedDB (`lunaclair-db`).
- **Synchronous Preferences**: Synchronous UI settings (such as theme) remain in `localStorage` for instant pre-mount styling to avoid FOUC.

---

## 6. Migration Strategy

- **`DatabaseMigrator` Service**: On initial startup, `DatabaseMigrator` checks for existing legacy `localStorage` keys (`lunaclair.library.materials`, `lunaclair.reader.annotations.*`).
- **Data Transfer**: Migrates legacy material definitions, highlights, and drawings into `materials`, `highlights`, and `drawings` object stores in IndexedDB.
- **Audit Logging**: Writes `databaseVersion: 1`, `lastMigration`, and `createdAt` into the `metadata` object store.

---

## 7. Error Handling & Guarding Strategy

- **Unrecognized Question Types**: `QuestionStrategyResolver` throws explicit domain errors if an unsupported `QuestionType` is evaluated.
- **Transactional Rollback**: `DexieQuizSessionRepository` performs quiz session persistence inside Dexie transactions (`db.transaction('rw', ...)`), rolling back cleanly if write errors occur.
- **Query Fallbacks**: Query hooks supply clean fallback arrays (`[]`) and loading flags (`isLoading`, `isError`) to prevent component crashes.

---

## 8. End-to-End Data Flow

```text
[User Submits Answer in UI]
       │
       ▼
[useSessionMutations.submitAnswer()]
       │
       ▼
[AssessmentService.gradeAnswer(question, userAnswer)]
       │
       ▼
[QuestionStrategyResolver.get(question.type)]
       │
       ▼
[Strategy.grade(question, userAnswer)] → Returns GradingResult
       │
       ▼
[DexieQuizSessionRepository.submitAnswer()]
       │
       ▼
[Dexie Transaction] → Writes to IndexedDB object store
       │
       ▼
[TanStack Query Invalidation] → Re-fetches assessment queries & updates UI
```

---

## 9. Deprecated / Removed Architecture

- **`LocalStorageLibraryRepository` & `LocalStorageAnnotationRepository`**: Retired in favor of `DexieLibraryRepository` and `DexieAnnotationRepository`.
- **Direct localStorage Key Access**: Completely removed from domain and feature modules.

---

## 10. Verification & Quality Assurance

- **Build Check (`npm run build`)**: Passed cleanly. Transpiled 2257 modules with `tsc -b` and created Vite production bundle with **0 type errors**.
- **Linter Check (`npm run lint`)**: Passed cleanly with **0 warnings and 0 errors** across 151 files inspected by `oxlint`.

---

## 11. Full System Architecture Overview

```text
src/
├── app/            — Root layout, DI context, AppProviders, bootstrap
├── domain/         — Pure domain models (quiz, reader, library) & AssessmentService
├── infrastructure/ — Database layer (LunaClairDatabase, Dexie repositories, migrator, seeder)
├── features/       — Feature modules (reader, quiz, library) with queries, hooks, renderers
└── shared/         — Shared types, constants, utilities, base UI primitives
```

---

## 12. Final Assessment & Next Phase Readiness

- **Status**: **100% Complete & Production-Ready**.
- **Technical Debt**: None.
- **Next Phase Readiness**: LunaClair is fully prepared for **Phase 6 (Flashcards & Spaced Repetition)**, which will build directly on the `Question` and `Material` relationships established in Phase 5.
