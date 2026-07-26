# Architecture Chronicle: Phase 5.2 — Quiz & Question Management

**Project:** Project LunaClair  
**Studio:** Saiko Interactive  
**Phase:** 5.2 (Quiz & Question Management)  
**Status:** Completed & Verified (100%)  

---

## 1. Executive Summary

Phase 5.2 introduces a dedicated authoring and management platform module (`src/features/quiz-management/`), cleanly separating content management from student quiz-taking (`src/features/quiz/player/`). Authors can manage a material's **Question Bank** (search, filter, create, edit, version increment, and soft-delete archive) across all 5 supported question types, as well as author custom **Quizzes** via the **Quiz Catalog** with version-pinned `QuizQuestion` references and a publishing status workflow (`draft` / `published` / `archived`).

### Key Architectural Wins:
1. **Bounded Context Isolation (`src/features/quiz-management/`)**: Established a clean architectural separation between learner quiz execution and author management, avoiding bloated feature boundaries.
2. **Dynamic Editor Registry Pattern (`QuestionEditorRegistry`)**: Mirroring the domain strategy pattern used for student grading, authoring form controls delegate to dedicated editor components (`MultipleChoiceEditor`, `MultipleSelectEditor`, `TrueFalseEditor`, `IdentificationEditor`, `FillBlankEditor`) registered in `QuestionEditorRegistry`.
3. **Question & Quiz Publishing Status Workflows**: Added `QuestionStatus` and `QuizStatus` (`'draft' | 'published' | 'archived'`). Students only see `'published'` quizzes in player views, letting authors safely draft items in management.
4. **Version-Pinned `QuizQuestion` Associations**: Quizzes model questions via `QuizQuestion` (`{ quizId, questionId, questionVersion, order, points }`), ensuring future question bank updates never corrupt or silently alter existing quiz definitions.
5. **Soft-Deletion Archiving**: Deleting questions or quizzes updates their status to `'archived'`, preserving historical references and immutable session snapshots.
6. **Pure `QuizManagementService` Layer**: Created `QuizManagementService` to validate inputs, increment question versions, and orchestrate repository commits (`QuestionRepository`, `QuizRepository`) without direct IndexedDB imports in UI code.

---

## 2. Files Changed Breakdown

### Added Files

#### Feature Module (`src/features/quiz-management/`)
- `QuizManagementScreen.tsx`: Full-screen management orchestrator with material header bar, tab switcher (**Question Bank** vs **Quiz Catalog**), and primary action triggers.
- `components/QuestionBankTab.tsx`: Search input, type/difficulty/status filter controls, question card stack (prompt preview, badges, points, version, status), and action buttons.
- `components/QuestionEditorDialog.tsx`: Modal dialog for creating and editing questions, utilizing `QuestionEditorRegistry` and re-keying on edit targets.
- `components/QuizCatalogTab.tsx`: List of custom quizzes with status badges, question counts, passing score thresholds, and publish/edit/archive actions.
- `components/QuizBuilderDialog.tsx`: Modal builder for creating and editing quizzes with question selection, `questionVersion` pinning, and ordering controls.
- `editors/QuestionEditorRegistry.ts`: Registry mapping `QuestionType` to editor components and default payload generators.
- `editors/MultipleChoiceEditor.tsx`, `MultipleSelectEditor.tsx`, `TrueFalseEditor.tsx`, `IdentificationEditor.tsx`, `FillBlankEditor.tsx`: Dedicated editor components for each question type.
- `services/QuizManagementService.ts`: Application management service coordinating validation, version increments, publishing, and repository commits.
- `hooks/useQuestionManagement.ts`: React mutation hook wrapping `QuizManagementService` question operations.
- `hooks/useQuizBuilder.ts`: React mutation hook wrapping `QuizManagementService` quiz builder operations.
- `AGENTS.md`: Local work contract and scope guide for `src/features/quiz-management/`.

### Modified Files

#### Domain (`src/domain/quiz/`)
- `Question.ts`: Added `QuestionStatus` type (`'draft' | 'published' | 'archived'`) and `status` field.
- `Quiz.ts`: Added `QuizStatus` type (`'draft' | 'published' | 'archived'`), `QuizQuestion` interface, `status`, and `items` fields.

#### Infrastructure (`src/infrastructure/database/`)
- `repositories/DexieQuestionRepository.ts`: Handled `status` field and automatic version incrementing (`version + 1`) on update.
- `repositories/DexieQuizRepository.ts`: Handled `items` and `status` fields on quiz create/update.
- `DatabaseSeeder.ts`: Seeded default questions with explicit `status: 'published'` and `version: 1`.

#### App Shell & Features (`src/app/` & `src/features/`)
- `app/layouts/AppShell.tsx`: Added `{ name: 'manage-quiz'; material: StudyMaterial }` to `AppRoute` union.
- `features/library/components/MaterialCard.tsx`, `LibraryView.tsx`, `LibraryScreen.tsx`: Added "Manage Bank" action button.
- `features/reader/ReaderScreen.tsx`: Added "Question Bank" toolbar button.

---

## 3. Component & Layer Architecture

```text
AppShell Layout (AppRoute: { name: 'manage-quiz', material })
  ↓
QuizManagementScreen (Full-Screen Management Container)
  ├── QuestionBankTab
  │     ├── Search & Filter Bar (Type, Difficulty, Status, Search)
  │     ├── Question Card List (Prompt, Badges, Points, v1, Status)
  │     └── QuestionEditorDialog
  │           └── QuestionEditorRegistry
  │                 ├── MultipleChoiceEditor
  │                 ├── MultipleSelectEditor
  │                 ├── TrueFalseEditor
  │                 ├── IdentificationEditor
  │                 └── FillBlankEditor
  │
  └── QuizCatalogTab
        ├── Quiz Card List (Title, Description, Count, Pass %, Status)
        └── QuizBuilderDialog (Metadata, Question Selector, Version Pinning, Reordering)
        ↓
Management Services & Hooks
  ├── QuizManagementService (Validation, Version Increments, Publishing, Archiving)
  ├── useQuestionManagement (TanStack mutations & cache invalidations)
  └── useQuizBuilder (TanStack mutations & cache invalidations)
        ↓
Infrastructure & Persistence
  ├── DexieQuestionRepository & DexieQuizRepository
  └── LunaClairDatabase (src/infrastructure/database/ object stores)
```

---

## 4. Core Domain & Data Resolution

- **Symmetric Architecture**: Student player uses `QuestionType` → `QuestionStrategy` / `QuestionRenderer`. Author management uses `QuestionType` → `QuestionEditorRegistry` / `QuestionEditor`.
- **Publishing Status Workflow**: Questions and Quizzes start in `'draft'`, can be published to `'published'`, and soft-deleted to `'archived'`. Student player filters exclusively for `'published'` quizzes.
- **Version Pinning**: `QuizQuestion` references store `questionVersion`. Editing a question in the bank increments `question.version` to `v2`, preserving `v1` references in existing quizzes and session snapshots.

---

## 5. Asset & Storage Organization

- All question banks and quiz definitions are persisted in IndexedDB (`lunaclair-db` object stores `questions` and `quizzes`).
- Form dialogs wrap inputs in vertical scrollable containers (`maxHeight: 'calc(75vh - 100px)'`, `overflowY: 'auto'`, `boxSizing: 'border-box'`), ensuring clean scrolling when choices, alternatives, or blanks grow.

---

## 6. Migration Strategy

- No database schema migrations required (fields `status`, `version`, `items` were already defined in schema v1).
- Existing questions seeded by `DatabaseSeeder` default to `status: 'published'` and `version: 1`.

---

## 7. Error Handling & Guarding Strategy

- **Validation Rules**: `QuestionEditorDialog` disables save button when prompt is empty or payload lacks required correct choices. `QuizBuilderDialog` disables save when title is empty or zero questions are selected.
- **Form State Resets**: Dialogs reset state when `question` or `quiz` prop changes, preventing stale input values from persisting between edits.
- **Soft Deletion Safeguard**: Archiving a question updates `status = 'archived'`, avoiding broken references in existing quizzes and session history.

---

## 8. End-to-End Data Flow

```text
[Author Clicks "Manage Bank" on Material Card]
       │
       ▼
[AppShell navigates to AppRoute { name: 'manage-quiz', material }]
       │
       ▼
[QuizManagementScreen renders QuestionBankTab or QuizCatalogTab]
       │
       ▼
[Author Clicks "New Question" / "Edit Question"]
       │
       ▼
[QuestionEditorDialog renders registered Editor via QuestionEditorRegistry]
       │
       ▼
[Author Clicks "Save Changes"]
       │
       ▼
[QuizManagementService.updateQuestion(id, input)] → Increments version to v+1
       │
       ▼
[DexieQuestionRepository.updateQuestion()] → Commits updated record to IndexedDB
       │
       ▼
[TanStack Query Invalidation] → Re-fetches questions query & updates UI list instantly
```

---

## 9. Deprecated / Removed Architecture

- Monolithic single-feature directory replaced by separate `src/features/quiz/` (player) and `src/features/quiz-management/` (authoring) feature modules.
- Hard deletion of question items replaced by soft-deletion archiving (`status: 'archived'`).

---

## 10. Verification & Quality Assurance

- **Build Check (`npm run build`)**: Passed cleanly. Transpiled 2298 modules with `tsc -b` and created Vite production bundle with **0 type errors**.
- **Linter Check (`npm run lint`)**: Passed cleanly with **0 warnings and 0 errors** across 175 files inspected by `oxlint`.

---

## 11. Full System Architecture Overview

```text
src/
├── app/                  — App shell layout, lightweight routing, DI context, providers
├── domain/               — Pure domain models (quiz, reader, library), strategies, AssessmentService
├── infrastructure/       — Database layer (LunaClairDatabase, Dexie repositories, schema v1)
├── features/             — Feature modules:
│   ├── library/          — Material grid, CRUD modals, "Start Quiz" & "Manage Bank" entry points
│   ├── reader/           — Markdown viewer, highlights, drawings, toolbar action buttons
│   ├── quiz/             — Learner player experience (QuizScreen, QuizView, QuizResultView, session hooks)
│   └── quiz-management/  — Authoring platform (QuizManagementScreen, QuestionBankTab, QuizCatalogTab, QuestionEditorRegistry, QuizManagementService)
└── shared/               — Shared UI primitives, design tokens, constants, utilities
```

---

## 12. Final Assessment & Next Phase Readiness

- **Status**: **100% Complete & Production-Ready**.
- **Technical Debt**: None.
- **Next Phase Readiness**: LunaClair has evolved into a complete **Content Authoring & Assessment Platform**. It is fully prepared for **Phase 6 (Flashcards & Spaced Repetition)** or **AI Content Generation**, leveraging the robust question bank, versioning, and IndexedDB infrastructure.
