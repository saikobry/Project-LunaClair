# src/features/quiz-management/ — Quiz & Question Management

## Purpose

Authoring feature for creating, editing, publishing, and archiving questions and quizzes. Separate from the learner quiz-taking experience (`src/features/quiz/`). Provides a Question Bank manager, Quiz Catalog, the quiz canvas builder (Google Forms-style authoring, rendered on a dedicated `quiz-canvas` app-shell route so the global sidebar stays visible), type-specific question editors, and publishing workflows. The quiz canvas builder is a sub-feature — see `canvas/AGENTS.md` for its contracts.

## Ownership

| File / Module | Responsibility |
|---|---|
| `QuizManagementScreen.tsx` | Feature orchestrator — tab navigation (Question Bank / Quiz Catalog), data fetching, wires management hooks. Rendered embedded inside MaterialWorkspace (no self-owned Page shell or back button) |
| `components/QuestionBankTab.tsx` | Question list with search (matches prompt OR tags — leading `#` stripped; tag chips clickable to filter/toggle), type/difficulty/status filters, quiz usage tags ("Used in X quizzes" / "Not used in any quiz"), archive confirmation safeguards for shared questions, and empty state CTAs |
| `components/QuestionPayloadPreview.tsx` | Read-only presentation preview of authored question payload structures (choices with correct ticks, True/False blocks, fill-in-blank templates) |
| `components/QuestionEditorDialog.tsx` | Modal form for creating/editing questions — metadata inputs (tags via shared `TagInput` chip entry, case-preserving) + type-specific editor |
| `components/QuizCatalogTab.tsx` | Quiz list with visible card containers (1px border, radius 10, status accent strip on the left edge, hover accent border + subtle lift), status badges, chip-styled question-count / pass-rate metadata, publish/archive controls (archive requires confirmation dialog), Create/Edit buttons navigate to the dedicated `quiz-canvas` route (`onNavigate({ kind: 'quiz-canvas', materialId, quizId? })`) |
| `canvas/` | Quiz canvas authoring sub-feature — self-contained subsystem (state `useQuizCanvas`, lifecycle `useQuizCanvasEditor`, motion engine, debug tooling). Public contract: exports `QuizCanvasBuilder` only, re-exported by this barrel for `AppShell`. Full contracts in `canvas/AGENTS.md` |
| `components/QuizBuilderDialog.tsx` | `@deprecated` — superseded by `QuizCanvasBuilder`, kept during transition |
| `editors/QuestionEditorRegistry.ts` | Registry mapping `QuestionType` → editor component; default payload factory; `QUESTION_TYPE_OPTIONS` labels |
| `editors/MultipleChoiceEditor.tsx` | Choice inputs + radio for correctIndex |
| `editors/MultipleSelectEditor.tsx` | Choice inputs + checkboxes for correctIndices |
| `editors/TrueFalseEditor.tsx` | Radio toggle for True/False |
| `editors/IdentificationEditor.tsx` | Primary answer + accepted alternatives |
| `editors/FillBlankEditor.tsx` | Template textarea + blank answer inputs |
| `hooks/useQuestionManagement.ts` | Thin mutation adapter for application question use cases |
| `hooks/useQuizBuilder.ts` | Thin mutation adapter for application quiz use cases (publish/archive/unarchive; `createQuiz`/`updateQuiz` retained only for the deprecated dialog) |
| `index.ts` | Barrel export of public API — `QuizManagementScreen` and `QuizCanvasBuilder` (re-exported from `canvas/`, consumed by `AppShell` for the `quiz-canvas` route) |

## Local Contracts

- No cross-feature imports — this feature does not import from `src/features/quiz/`
- Query repository access via application context; mutations call `context.useCases.quizManagement`
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

| Child | Scope | Purpose |
|---|---|---|
| `canvas/AGENTS.md` | `canvas/` | Quiz canvas authoring sub-feature — state, lifecycle, motion engine, debug tooling |
