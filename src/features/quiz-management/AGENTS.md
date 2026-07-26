# src/features/quiz-management/ — Quiz & Question Management

## Purpose

Authoring feature for creating, editing, publishing, and archiving questions and quizzes. Separate from the learner quiz-taking experience (`src/features/quiz/`). Provides a Question Bank manager, Quiz Catalog builder, type-specific question editors, and publishing workflows.

## Ownership

| File / Module | Responsibility |
|---|---|
| `QuizManagementScreen.tsx` | Feature orchestrator — tab navigation (Question Bank / Quiz Catalog), data fetching, wires management hooks |
| `components/QuestionBankTab.tsx` | Question list with search, type/difficulty/status filters, publish/archive actions |
| `components/QuestionEditorDialog.tsx` | Modal form for creating/editing questions — metadata inputs + type-specific editor |
| `components/QuizCatalogTab.tsx` | Quiz list with status badges, publish/archive controls, quiz builder trigger |
| `components/QuizBuilderDialog.tsx` | Quiz metadata form + question selector with version pinning and reordering |
| `editors/QuestionEditorRegistry.ts` | Registry mapping `QuestionType` → editor component; default payload factory |
| `editors/MultipleChoiceEditor.tsx` | Choice inputs + radio for correctIndex |
| `editors/MultipleSelectEditor.tsx` | Choice inputs + checkboxes for correctIndices |
| `editors/TrueFalseEditor.tsx` | Radio toggle for True/False |
| `editors/IdentificationEditor.tsx` | Primary answer + accepted alternatives |
| `editors/FillBlankEditor.tsx` | Template textarea + blank answer inputs |
| `services/QuizManagementService.ts` | Application service — question validation, version increments, soft-delete archiving, quiz publishing |
| `hooks/useQuestionManagement.ts` | Mutation hook wrapping QuizManagementService for question CRUD + publish/archive |
| `hooks/useQuizBuilder.ts` | Mutation hook wrapping QuizManagementService for quiz CRUD + publish/archive |
| `index.ts` | Barrel export of public API (QuizManagementScreen) |

## Local Contracts

- No cross-feature imports — this feature does not import from `src/features/quiz/`
- Repository access via `RepositoryContext` (same DI pattern as other features)
- Query keys match the assessment namespace: `['assessment', 'questions', materialId]` and `['assessment', 'quizzes', materialId]`
- `QuestionStatus` lifecycle: `draft` → `published` → `archived`
- `QuizStatus` lifecycle: `draft` → `published` → `archived`
- Archiving is soft-delete — never hard-deletes questions that may be referenced by quizzes
- `QuizQuestion` version pinning: quizzes snapshot `questionVersion` at creation time
- UI components contain zero grading, scoring, or persistence logic

## Work Guidance

- Editor symmetry: `QuestionRenderer` (student) ↔ `QuestionEditor` (author), `QuestionStrategy` ↔ `QuestionEditorRegistry`
- New question types require: domain payload, strategy, renderer, editor, and registry entry

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has all its modules in flat subdirectories.
