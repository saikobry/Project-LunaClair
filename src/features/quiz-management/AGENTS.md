# src/features/quiz-management/ — Quiz & Question Management

## Purpose

Authoring feature for creating, editing, publishing, and archiving questions and quizzes. Separate from the learner quiz-taking experience (`src/features/quiz/`). Provides a Question Bank manager, Quiz Catalog, the quiz canvas builder (Google Forms-style authoring, rendered on a dedicated `quiz-canvas` app-shell route so the global sidebar stays visible), type-specific question editors, and publishing workflows. The quiz canvas builder is a sub-feature — see `canvas/AGENTS.md` for its contracts.

## Ownership

| File / Module | Responsibility |
|---|---|
| `QuizManagementScreen.tsx` | Feature orchestrator — renders one authoring surface (`section`: Question Bank or Quiz Catalog, owned by the workspace `?tab=`), data fetching, wires management hooks. Rendered embedded inside MaterialWorkspace (no self-owned Page shell, back button, tab bar, or material-level Share/Export) |
| `components/QuestionBankTab.tsx` | Question list with search (matches prompt OR tags — leading `#` stripped; tag chips clickable to filter/toggle), type/difficulty/status filters, quiz usage tags ("Used in X quizzes" / "Not used in any quiz"), archive confirmation safeguards for shared questions, and empty state CTAs |
| `components/QuestionPayloadPreview.tsx` | Read-only presentation preview of authored question payload structures (choices with correct ticks, True/False blocks, fill-in-blank templates) |
| `components/QuestionEditorDialog.tsx` | Modal form for creating/editing questions — metadata inputs (tags via shared `TagInput` chip entry, case-preserving) + type-specific editor |
| `components/QuizCatalogTab.tsx` | Quiz list with visible card containers (1px border, radius 10, status accent strip on the left edge, hover accent border + subtle lift), status badges, chip-styled question-count / pass-rate metadata, publish/archive controls (archive requires confirmation dialog), Create/Edit buttons navigate to the dedicated `quiz-canvas` route (`onNavigate({ kind: 'quiz-canvas', materialId, quizId? })`) |
| `canvas/` | Quiz canvas authoring sub-feature — self-contained subsystem (state `useQuizCanvas`, lifecycle `useQuizCanvasEditor`, motion engine, debug tooling). Public contract: exports `QuizCanvasBuilder` only, consumed by `AppShell` via the direct path (`canvas/QuizCanvasBuilder`). Full contracts in `canvas/AGENTS.md` |
| `editors/QuestionEditorRegistry.ts` | Registry mapping `QuestionType` → editor component; default payload factory; `QUESTION_TYPE_OPTIONS` labels |
| `editors/MultipleChoiceEditor.tsx` | Choice inputs + radio for correctIndex |
| `editors/MultipleSelectEditor.tsx` | Choice inputs + checkboxes for correctIndices |
| `editors/TrueFalseEditor.tsx` | Radio toggle for True/False |
| `editors/IdentificationEditor.tsx` | Primary answer + accepted alternatives |
| `editors/FillBlankEditor.tsx` | Template textarea + blank answer inputs |
| `components/CorrectAnswerIndicator.tsx` | Reusable circle/square correct answer indicator for question editors |
| `utils/quizBadgeAppearance.ts` | Single source of truth for semantic badge palette (difficulty, question type, points) |
| `hooks/useQuestionManagement.ts` | Thin mutation adapter for application question use cases |
| `hooks/useQuizBuilder.ts` | Thin mutation adapter for application quiz use cases — publish/archive/unarchive (`createQuiz`/`updateQuiz` mutations remain in the hook but are unused since the dialog's removal) |


## Local Contracts

- No cross-feature imports — this feature does not import from `src/features/quiz/`
- Query repository access via application context; mutations call `context.useCases.quizManagement`
- **Quiz Draft Repository Exception (CQRS):** `useQuizCanvasEditor` directly calls `context.repositories.quizDraft.saveDraft()` and `.deleteDraft()` for crash-recovery draft autosaving. This is an intentional architectural exception — quiz drafts are ephemeral editor state, not business entities. Creating `SaveQuizDraftUseCase` / `DeleteQuizDraftUseCase` wrappers would add no meaningful domain behavior. The primary save path (`handleSave`) correctly routes through `SaveQuizUseCase`.
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

- `npm run build`
- `npm run lint`

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `canvas/AGENTS.md` | `canvas/` | Quiz canvas authoring sub-feature — state, lifecycle, motion engine, debug tooling |
