# src/features/quiz-management/ — Quiz & Question Management

## Purpose

Authoring feature for creating, editing, publishing, and archiving questions and quizzes. Separate from the learner quiz-taking experience (`src/features/quiz/`). Provides a Question Bank manager, Quiz Catalog builder, type-specific question editors, and publishing workflows.

## Ownership

| File / Module | Responsibility |
|---|---|
| `QuizManagementScreen.tsx` | Feature orchestrator — tab navigation (Question Bank / Quiz Catalog), data fetching, wires management hooks. Rendered embedded inside MaterialWorkspace (no self-owned Page shell or back button) |
| `components/QuestionBankTab.tsx` | Question list with search, type/difficulty/status filters, quiz usage tags ("Used in X quizzes" / "Not used in any quiz"), archive confirmation safeguards for shared questions, and empty state CTAs |
| `components/QuestionEditorDialog.tsx` | Modal form for creating/editing questions — metadata inputs + type-specific editor |
| `components/QuizCatalogTab.tsx` | Quiz list with status badges, publish/archive controls (archive requires confirmation dialog), quiz builder trigger |
| `components/QuizBuilderDialog.tsx` | Quiz metadata form + question selector with version pinning and reordering |
| `editors/QuestionEditorRegistry.ts` | Registry mapping `QuestionType` → editor component; default payload factory |
| `editors/MultipleChoiceEditor.tsx` | Choice inputs + radio for correctIndex |
| `editors/MultipleSelectEditor.tsx` | Choice inputs + checkboxes for correctIndices |
| `editors/TrueFalseEditor.tsx` | Radio toggle for True/False |
| `editors/IdentificationEditor.tsx` | Primary answer + accepted alternatives |
| `editors/FillBlankEditor.tsx` | Template textarea + blank answer inputs |
| `hooks/useQuestionManagement.ts` | Thin mutation adapter for application question use cases |
| `hooks/useQuizBuilder.ts` | Thin mutation adapter for application quiz use cases |
| `index.ts` | Barrel export of public API (QuizManagementScreen) |

## Local Contracts

- No cross-feature imports — this feature does not import from `src/features/quiz/`
- Query repository access via application context; mutations call `context.useCases.quizManagement`.
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
