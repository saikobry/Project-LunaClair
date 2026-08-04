# src/features/quiz-management/ — Quiz & Question Management

## Purpose

Authoring feature for creating, editing, publishing, and archiving questions and quizzes. Separate from the learner quiz-taking experience (`src/features/quiz/`). Provides a Question Bank manager, Quiz Catalog, the full-screen quiz canvas builder (Google Forms-style authoring), type-specific question editors, and publishing workflows.

## Ownership

| File / Module | Responsibility |
|---|---|
| `QuizManagementScreen.tsx` | Feature orchestrator — tab navigation (Question Bank / Quiz Catalog), data fetching, wires management hooks. Rendered embedded inside MaterialWorkspace (no self-owned Page shell or back button) |
| `components/QuestionBankTab.tsx` | Question list with search, type/difficulty/status filters, quiz usage tags ("Used in X quizzes" / "Not used in any quiz"), archive confirmation safeguards for shared questions, and empty state CTAs |
| `components/QuestionEditorDialog.tsx` | Modal form for creating/editing questions — metadata inputs + type-specific editor |
| `components/QuizCatalogTab.tsx` | Quiz list with status badges, publish/archive controls (archive requires confirmation dialog), opens the full-screen canvas builder for create/edit |
| `components/QuizCanvasBuilder.tsx` | Full-screen Google Forms-style authoring workspace: sticky header (back, autosave badge, reserved AI/Preview/History/Settings slots, Save Quiz), recovery banner, title/description header card, scrollable card canvas, active-card floating toolbar. Owns the editor lifecycle: seeds the draft, runs `useDraftAutosave`, invokes `SaveQuizUseCase`, deletes the Dexie draft and invalidates `['assessment']` queries on save success |
| `components/QuizCanvasQuestionCard.tsx` | Single canvas question card — collapsed/active states, drag handle, type dropdown (locked for bank-linked cards), points input, inline validation errors, type editor embedding |
| `components/QuizCanvasBankImportDialog.tsx` | Picker importing Question Bank questions onto the canvas as bank-linked cards |
| `components/QuizBuilderDialog.tsx` | `@deprecated` — superseded by `QuizCanvasBuilder`, kept during transition |
| `editors/QuestionEditorRegistry.ts` | Registry mapping `QuestionType` → editor component; default payload factory; `QUESTION_TYPE_OPTIONS` labels |
| `editors/MultipleChoiceEditor.tsx` | Choice inputs + radio for correctIndex |
| `editors/MultipleSelectEditor.tsx` | Choice inputs + checkboxes for correctIndices |
| `editors/TrueFalseEditor.tsx` | Radio toggle for True/False |
| `editors/IdentificationEditor.tsx` | Primary answer + accepted alternatives |
| `editors/FillBlankEditor.tsx` | Template textarea + blank answer inputs |
| `hooks/useQuestionManagement.ts` | Thin mutation adapter for application question use cases |
| `hooks/useQuizBuilder.ts` | Thin mutation adapter for application quiz use cases (publish/archive/unarchive; `createQuiz`/`updateQuiz` retained only for the deprecated dialog) |
| `hooks/useQuizCanvas.ts` | Pure canvas state hook — `QuizDraft` DTO, `activeCardId`, and card mutations (add below, duplicate, delete, reorder, type change, bank import) keyed by stable `tempId`s |
| `index.ts` | Barrel export of public API (QuizManagementScreen) |

## Local Contracts

- No cross-feature imports — this feature does not import from `src/features/quiz/`
- Query repository access via application context; mutations call `context.useCases.quizManagement`
- Query keys match the assessment namespace: `['assessment', 'questions', materialId]` and `['assessment', 'quizzes', materialId]`
- `QuestionStatus` lifecycle: `draft` → `published` → `archived`
- `QuizStatus` lifecycle: `draft` → `published` → `archived`
- Archiving is soft-delete — never hard-deletes questions that may be referenced by quizzes
- `QuizQuestion` version pinning: quizzes snapshot `questionVersion` at creation time
- UI components contain zero grading, scoring, or persistence logic
- 3-layer save model: (1) canvas state in `useQuizCanvas`, (2) autosaved `QuizDraft` in Dexie `quizEditingDrafts` via shared `useDraftAutosave` (2s debounce / blur / unload / 30s max throttle), (3) explicit Save Quiz → `SaveQuizUseCase` atomic transaction. The Question Bank and Quiz Catalog are only written on explicit save; drafts exist purely for crash recovery
- Question Bank is the single source of truth: imported canvas cards reference `questionId`; editing them updates the bank question on save and bumps `questionVersion` when prompt/payload content changes (points/order/metadata never bump). Bank-linked cards cannot change type. Duplicated cards detach from the bank (new question on save)
- After save success, `QuizCanvasBuilder` deletes the local draft, invalidates `['assessment']` caches, and rebinds the session to the saved `quizId`

## Work Guidance

- Editor symmetry: `QuestionRenderer` (student) ↔ `QuestionEditor` (author), `QuestionStrategy` ↔ `QuestionEditorRegistry`
- New question types require: domain payload, strategy, renderer, editor, and registry entry

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has all its modules in flat subdirectories.
