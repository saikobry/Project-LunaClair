# src/features/quiz-management/ — Quiz & Question Management

## Purpose

Authoring feature for creating, editing, publishing, and archiving questions and quizzes. Separate from the learner quiz-taking experience (`src/features/quiz/`). Provides a Question Bank manager, Quiz Catalog, the quiz canvas builder (Google Forms-style authoring, rendered on a dedicated `quiz-canvas` app-shell route so the global sidebar stays visible), type-specific question editors, and publishing workflows.

## Ownership

| File / Module | Responsibility |
|---|---|
| `QuizManagementScreen.tsx` | Feature orchestrator — tab navigation (Question Bank / Quiz Catalog), data fetching, wires management hooks. Rendered embedded inside MaterialWorkspace (no self-owned Page shell or back button) |
| `components/QuestionBankTab.tsx` | Question list with search, type/difficulty/status filters, quiz usage tags ("Used in X quizzes" / "Not used in any quiz"), archive confirmation safeguards for shared questions, and empty state CTAs |
| `components/QuestionEditorDialog.tsx` | Modal form for creating/editing questions — metadata inputs + type-specific editor |
| `components/QuizCatalogTab.tsx` | Quiz list with status badges, publish/archive controls (archive requires confirmation dialog), Create/Edit buttons navigate to the dedicated `quiz-canvas` route (`onNavigate({ kind: 'quiz-canvas', materialId, quizId? })`) |
| `components/QuizCanvasBuilder.tsx` | Google Forms-style authoring workspace rendered on the **dedicated `quiz-canvas` screen route** — full-height (`flex: 1`, `height: 100%`) `div.workspace-container` filling `<main>` with an internally scrolling canvas, so the sidebar stays visible and Focus Mode stays toggleable while editing. Exported from the feature barrel for `AppShell`. Thin shell: workspace frame, sticky header (back, autosave badge, reserved AI/Preview/History/Settings slots, Save Quiz), crash-recovery `Banner` (shared Astryx adapter), loading state, bank import dialog. Editor lifecycle delegated to `useQuizCanvasEditor`; canvas body to `QuizCanvasQuestionList` |
| `components/QuizCanvasMetaCard.tsx` | Quiz title/description header card with passing-percentage `NumberInput` (shared Astryx adapter, `units="%"`) |
| `components/QuizCanvasQuestionList.tsx` | Scrollable canvas body: meta card, question cards (active card gets the floating toolbar), empty state, add-question button. Owns drag-and-drop reorder presentation via shared `useDragReorder`; all draft mutations delegate through the `canvas` API |
| `components/QuizCanvasQuestionCard.tsx` | Single canvas question card — collapsed/active states, drag handle, type dropdown (locked for bank-linked cards), points `NumberInput`, inline validation errors, type editor embedding |
| `components/QuizCanvasCardToolbar.tsx` | Active-card action bar (add/duplicate/move/import/delete) — Google Forms responsive positioning: `position: absolute; right: -52px` vertical dock on desktop (≥769px), fixed centered bottom navbar on mobile (≤768px) at `bottom: calc(84px + safe-area)`, dropping to `calc(16px + safe-area)` when Focus Mode hides the bottom nav (`useFocusMode` context, optional `isFocusMode` prop override) |
| `components/QuizCanvasBankImportDialog.tsx` | Picker importing Question Bank questions onto the canvas as bank-linked cards (selection via shared Astryx `Checkbox` adapter) |
| `components/QuizBuilderDialog.tsx` | `@deprecated` — superseded by `QuizCanvasBuilder`, kept during transition |
| `editors/QuestionEditorRegistry.ts` | Registry mapping `QuestionType` → editor component; default payload factory; `QUESTION_TYPE_OPTIONS` labels |
| `editors/MultipleChoiceEditor.tsx` | Choice inputs + radio for correctIndex |
| `editors/MultipleSelectEditor.tsx` | Choice inputs + checkboxes for correctIndices |
| `editors/TrueFalseEditor.tsx` | Radio toggle for True/False |
| `editors/IdentificationEditor.tsx` | Primary answer + accepted alternatives |
| `editors/FillBlankEditor.tsx` | Template textarea + blank answer inputs |
| `hooks/useQuestionManagement.ts` | Thin mutation adapter for application question use cases |
| `hooks/useQuizBuilder.ts` | Thin mutation adapter for application quiz use cases (publish/archive/unarchive; `createQuiz`/`updateQuiz` retained only for the deprecated dialog) |
| `hooks/useQuizCanvas.ts` | Pure canvas state hook — `QuizDraft` DTO, `activeCardId`, and card mutations (add below, duplicate, delete, reorder, type change, bank import) keyed by stable `tempId`s. Exports the `QuizCanvas` result type for consumers |
| `hooks/useQuizCanvasEditor.ts` | Quiz canvas editor lifecycle hook — seeds the canvas from the catalog (or an empty draft), detects crash-recovery drafts, runs the 3-layer save model (`useDraftAutosave` Dexie draft → `SaveQuizUseCase` atomic commit), focus/scroll helpers, bank-import picker state, and Escape-to-close (window keydown, deferred while the bank import modal is open). Exposes the workspace `containerRef` (non-modal). Consumed by `QuizCanvasBuilder` |
| `index.ts` | Barrel export of public API — `QuizManagementScreen` and `QuizCanvasBuilder` (consumed by `AppShell` for the `quiz-canvas` route) |

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
- After save success, `useQuizCanvasEditor` deletes the local draft, invalidates `['assessment']` caches, and rebinds the session to the saved `quizId`

## Work Guidance

- Editor symmetry: `QuestionRenderer` (student) ↔ `QuestionEditor` (author), `QuestionStrategy` ↔ `QuestionEditorRegistry`
- New question types require: domain payload, strategy, renderer, editor, and registry entry

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has all its modules in flat subdirectories.
