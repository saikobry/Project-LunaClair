# src/features/quiz-management/ — Quiz & Question Management

## Purpose

Authoring feature for creating, editing, publishing, and archiving questions and quizzes. Separate from the learner quiz-taking experience (`src/features/quiz/`). Provides a Question Bank manager, Quiz Catalog, the quiz canvas builder (Google Forms-style authoring, rendered on a dedicated `quiz-canvas` app-shell route so the global sidebar stays visible), type-specific question editors, and publishing workflows. The quiz canvas builder is a sub-feature — see `canvas/AGENTS.md` for its contracts.

## Ownership

| File / Module | Responsibility |
|---|---|
| `QuizManagementScreen.tsx` | Feature orchestrator — renders one authoring surface (`section`: Question Bank or Quiz Catalog, owned by the workspace `?tab=`), data fetching, wires management hooks. Rendered embedded inside MaterialWorkspace (no self-owned Page shell, back button, tab bar, or material-level Share/Export). Passes the workspace's `generatorLaunch` channel through to the Question Bank section untouched (the Quiz Catalog never opens the generator, but the prop is required on both sections so no caller can silently drop the handoff) |
| `components/QuestionBankTab.tsx` | Question list, its search/filter state, the derived filtered list, the archive-confirmation safeguard for shared questions, both empty-state CTAs, and the three dialogs. **This is where the one generator dialog is mounted and where a launch handoff lands** (state owned by `hooks/useGeneratorLaunchClaim.ts`): the Bank's own "Generate with AI" opens it with the mixed default and no way back, while a claimed launch opens it with the launcher's preselected types and a "Study these questions" return. Composes `QuestionBankFilterBar` for the action bar and declares `QuestionBankCard` (still co-located here — the `no-giant-component` rule measures a function body, not the file, so the card did not have to move to clear it; Sep 2026). |
| `components/QuestionBankFilterBar.tsx` & `components/questionBankFilterBar.stylex.ts` | The Bank's action bar — search, the three filters (inline ≥769px, behind a `Filter` disclosure below it), and the two entry points ("Generate with AI", "New Question"). Extracted from `QuestionBankTab` (Sep 2026) because it is a distinct rendered section with one job, and inline it made the tab a 300-line body. It owns **only** the <768px disclosure state — presentation of this bar and nothing else; the filter values stay with the tab, which is what derives the list from them. `canGenerate` carries the tab's `documentMarkdown` check so the disabled state and its reason stay together. |
| `components/questionBank.stylex.ts` | StyleX rules for the Bank's container, list, and card rows (project `*.stylex.ts` convention). The bar's own rules live with the bar. The `empty` rule was dropped in the Sep 2026 extraction: it was already dead before the move (both empty states render the shared `EmptyState`), and an extraction is the moment to stop carrying a rule forward. |
| `components/QuestionPayloadPreview.tsx` | Read-only presentation preview of authored question payload structures (choices with correct ticks, True/False blocks, fill-in-blank templates) |
| `components/QuestionEditorDialog.tsx` | Modal form for creating/editing questions — metadata inputs (tags via shared `TagInput` chip entry, case-preserving) + type-specific editor |
| `components/QuizCatalogTab.tsx` | Quiz list with visible card containers (1px border, radius 10, status accent strip on the left edge, hover accent border + subtle lift), status badges, chip-styled question-count / pass-rate metadata, publish/archive controls (archive requires confirmation dialog), Create/Edit buttons navigate to the dedicated `quiz-canvas` route (`onNavigate({ kind: 'quiz-canvas', materialId, quizId? })`) |
| `canvas/` | Quiz canvas authoring sub-feature — self-contained subsystem (state `useQuizCanvas`, lifecycle `useQuizCanvasEditor`, motion engine, debug tooling). Public contract: exports `QuizCanvasBuilder` only, consumed by `AppShell` via the direct path (`canvas/QuizCanvasBuilder`). Full contracts in `canvas/AGENTS.md` |
| `editors/QuestionEditorRegistry.ts` | Registry mapping `QuestionType` → editor component; default payload factory; `QUESTION_TYPE_OPTIONS` derived from the domain's `QUESTION_TYPE_LABELS` (no local label list) |
| `editors/MultipleChoiceEditor.tsx` | Single-correct wrapper over `ChoiceListRow` — owns `correctIndex`, choice index management, and the min-2 guard |
| `editors/MultipleSelectEditor.tsx` | Multi-correct wrapper over `ChoiceListRow` — owns the `correctIndices` membership toggle and the index-shift-on-remove reduce |
| `editors/ChoiceListRow.tsx` | Shared choice row (correct-answer indicator, choice input, remove button); owns `editors/choiceList.stylex.ts` and holds no selection-model knowledge |
| `editors/TrueFalseEditor.tsx` | Radio toggle for True/False |
| `editors/IdentificationEditor.tsx` | Primary answer + accepted alternatives |
| `editors/FillBlankEditor.tsx` | Template textarea + blank answer inputs |
| `components/CorrectAnswerIndicator.tsx` | Reusable circle/square correct answer indicator for question editors. Its unselected ring deliberately borrows an ink role (`--color-text-secondary`, 5.73:1 on white): the ring is the control's only visual affordance, so it must clear WCAG 1.4.11's 3:1 non-text contrast, which no border role reaches (1.27:1 / 1.47:1) |
| `utils/quizBadgeAppearance.ts` | Single source of truth for semantic badge palette (difficulty, question type, points) |
| `hooks/useQuestionManagement.ts` | Thin mutation adapter for application question use cases |
| `hooks/useQuizBuilder.ts` | Thin mutation adapter for application quiz use cases — publish/archive/unarchive (`createQuiz`/`updateQuiz` mutations remain in the hook but are unused since the dialog's removal) |
| `hooks/useGeneratorLaunchClaim.ts` | Owns the AI generator dialog's open state for one material, and owns the **launch-handoff contract types**: `GeneratorLaunchIntent` (`{ materialId, requestedTypes, returnTo: { tab, label } }`) and `GeneratorLaunchChannel` (`{ intent, onRetire }` — the pending request and the one command that retires it). The intent arrives as a **prop threaded from the workspace screen**, not from context: the screen holds the state (it is a one-shot command scoped to one material's workspace, not app-wide shared mode) and this hook is its single consumer. **The launch lifecycle is LATCH → RETIRE, in that order** (see Local Contracts). An intent addressed to another material is left alone, not consumed. Pinned by `components/__tests__/QuestionBankTab.test.tsx` (latch, exactly-once, `close()` idempotence, supersession) and by the owner's own screen test. Extracted from `QuestionBankTab` to keep the tab a composer rather than a state machine. |


## Local Contracts

- No cross-feature imports — this feature does not import from `src/features/quiz/`
- **The two choice editors are two wrappers over one row — never a `selection` variant prop.** The divergence is data shape (`correctIndex: number` vs `correctIndices: number[]`), so each wrapper keeps its own selection and index logic while `ChoiceListRow` takes `shape` + `isSelected` and callbacks only. A presentation-only divergence may justify a variant prop; a data-shape divergence does not.
- Query repository access via application context; mutations call `context.useCases.quizManagement`
- **The launch intent's lifecycle is LATCH → RETIRE, in that order, and `close()` is the idempotent fallback.** The claim is taken during render (the guarded `useVisitedTabs` pattern) so the dialog is configured on the **first paint** — preselected types and all — and the claimed intent is **latched into the hook's own state**, which is what `initialTypes` and the return label are read from. Retirement is then asked for by an effect **keyed on the latch**, and it fires *after* the commit.
  - **The effect must be keyed on the latch, not on an "unclaimed" flag.** A render-phase claim calls `setState` during render, so React re-renders the hook before committing and any "still unclaimed" flag is already `false` by the time an effect registers. Keyed on the flag the effect is unreachable — the shape the code had before Sep 2026, with `close()` silently carrying the entire one-shot guarantee. Keyed on the latch it runs on the render that commits.
  - **The latch is load-bearing, not bookkeeping.** Retiring during the claim, or by clearing the latch, empties the channel and closes the dialog on the same commit. The latch is what lets the effect run *after* the dialog is open and configured. Retirement is *asked for* rather than written into the owner mid-render, because emptying the owner's state during render is a cross-component render-phase update, which React rejects.
  - **Retirement is at-most-once per claim and is identity-checked twice.** The effect fires only when the channel's pending intent **is** the latched claim (so a launch that arrived while another was latched is left alone to be claimed when the current dialog closes), and a ref guard makes the call once per claim even if a consumer re-creates `onRetire` every render.
  - **`close()` retires the LATCHED claim, never the channel's current one** — that is what makes it safe under supersession — and drops the latch. It is idempotent: a claim the effect already retired is a no-op, and a dialog the Bank opened itself retires nothing. Closing therefore works whether or not the effect has run.
  - **A superseded dialog cannot clear the launch that replaced it.** Because both retirement sites name their target, an old dialog's `close()` reaches the owner with a target the owner no longer holds and is ignored. `onRetire` takes the intent as an argument precisely so the owner can make that comparison; an implementation empties its state unconditionally and the guarantee is gone.
- **An armed launch expires with the material it was armed for.** `ShellRoutes` renders the workspace screen **without a `key`**, so the instance (and its `useState`) is reused when the route's material changes. The screen therefore drops a pending intent whose `materialId` no longer matches the route — a render-phase adjustment, like `useVisitedTabs` and `lastInMode`. Without it, arming for A, opening B, and returning to A re-fires a request the user made long ago. An intent for another material is *not* consumed by the Bank that declines it; the owner is what expires it.
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
- `npx vitest run src/features/quiz-management` — the launch-handoff lifecycle (latch, exactly-once retirement, `close()` idempotence, supersession) lives in `components/__tests__/QuestionBankTab.test.tsx`.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `canvas/AGENTS.md` | `canvas/` | Quiz canvas authoring sub-feature — state, lifecycle, motion engine, debug tooling |
