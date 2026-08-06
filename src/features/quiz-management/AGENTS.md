# src/features/quiz-management/ — Quiz & Question Management

## Purpose

Authoring feature for creating, editing, publishing, and archiving questions and quizzes. Separate from the learner quiz-taking experience (`src/features/quiz/`). Provides a Question Bank manager, Quiz Catalog, the quiz canvas builder (Google Forms-style authoring, rendered on a dedicated `quiz-canvas` app-shell route so the global sidebar stays visible), type-specific question editors, and publishing workflows.

## Ownership

| File / Module | Responsibility |
|---|---|
| `QuizManagementScreen.tsx` | Feature orchestrator — tab navigation (Question Bank / Quiz Catalog), data fetching, wires management hooks. Rendered embedded inside MaterialWorkspace (no self-owned Page shell or back button) |
| `components/QuestionBankTab.tsx` | Question list with search, type/difficulty/status filters, quiz usage tags ("Used in X quizzes" / "Not used in any quiz"), archive confirmation safeguards for shared questions, and empty state CTAs |
| `components/QuestionEditorDialog.tsx` | Modal form for creating/editing questions — metadata inputs + type-specific editor |
| `components/QuizCatalogTab.tsx` | Quiz list with visible card containers (1px border, radius 10, status accent strip on the left edge, hover accent border + subtle lift), status badges, chip-styled question-count / pass-rate metadata, publish/archive controls (archive requires confirmation dialog), Create/Edit buttons navigate to the dedicated `quiz-canvas` route (`onNavigate({ kind: 'quiz-canvas', materialId, quizId? })`) |
| `components/QuizCanvasBuilder.tsx` | Google Forms-style authoring workspace rendered on the **dedicated `quiz-canvas` screen route** — full-height (`flex: 1`, `height: 100%`) `div.workspace-container` filling `<main>` with an internally scrolling canvas, so the sidebar stays visible and Focus Mode stays toggleable while editing. Exported from the feature barrel for `AppShell`. Thin shell: workspace frame, sticky header (back, autosave badge, reserved AI/Preview/History/Settings slots, Save Quiz; on mobile ≤768px the reserved slots and dividers hide, padding/gap shrink, and the title truncates so Save Quiz stays visible), crash-recovery `Banner` (shared Astryx adapter), loading state, bank import dialog. Editor lifecycle delegated to `useQuizCanvasEditor`; canvas body to `QuizCanvasQuestionList` |
| `components/QuizCanvasMetaCard.tsx` | Quiz title/description header card (visible chrome: 1px border, radius 12, `--shadow-low`, divider-separated passing-percentage row) with passing-percentage `NumberInput` (shared Astryx adapter, `units="%"`) |
| `components/QuizCanvasQuestionList.tsx` | Scrollable canvas body: meta card, single-column question accordion, empty state. Uses synchronous DOM height accumulation inside a layout effect before paint so expanding/collapsing cards never overlap, and glides cards between slots with GSAP tweens (`duration: 0.35`, `power2.out`). Opening a card runs a GSAP height tween from its last stable collapsed height to full editor height with frame-synced `onUpdate` repositioning, so lower cards are physically pushed in real time. Reorder is driven by per-card GSAP `Draggable` instances (grip trigger, direction-aware midpoint crossing swaps with a small hysteresis margin) bounded by the whole outer canvas column — meta card zone + question grid + reserved bottom dropzone (`BOTTOM_BUFFER = 200`) — so any card — collapsed or expanded — can travel up past Q1's midpoint and down past the last card's midpoint to reach any slot, while grabbing a handle auto-collapses the held card to its compact summary (`COMPACT_HEIGHT = 76`, sized for an unclipped 16px-padding collapsed card with its 2px accent border) the moment a drag begins and re-renders active cards as clean collapsed summaries (`isDragging` → `effectiveIsActive`, no clipped editor), so it glides lightweight through tight compact steps; on release it glides into its slot and the physical push engine re-expands it to full editor view. Card shadows are CSS-owned (`cardActive` / `cardDragging` classes, transitioned by the card's `transition`); GSAP tweens only scale/zIndex, never `box-shadow`, so the classes are never overridden by inline styles. GSAP re-measures the element bounds into each card's local space on every press, so no manual bounds refresh is needed. All draft mutations delegate through the `canvas` API |
| `components/QuizCanvasToolbarLane.tsx` | Decoupled right toolbar lane component (Google Forms Continuous Observation Pattern): owns the positioning wrapper (`position: absolute; top: 0`) and uses a `ResizeObserver` combined with physical `getBoundingClientRect` DOM measurement to track the active card's exact Y-offset relative to the shared `canvasBody` anchor. Glides smoothly via native CSS `transform: translateY(...)` (`cubic-bezier(0.2, 0, 0, 1)`). On mobile (<640px) the lane collapses and the toolbar renders as a floating bottom glassmorphism bar |
| `components/QuizCanvasQuestionCard.tsx` | Single canvas question card — collapsed/active states (while dragged, an active card renders as a clean collapsed summary via the `isDragging` prop → `effectiveIsActive`, no clipped editor), visual states: active card = prominent 2px accent border + indigo glow shadow (`cardActive`), held card = same 2px accent border + elevated floating shadow (`cardDragging`, CSS-owned — GSAP never tweens `box-shadow`), empty prompt shows a clean muted placeholder (no gray-italic fallback), grip drag handle (`data-canvas-drag-handle` trigger for the GSAP `Draggable` owned by `QuizCanvasQuestionList`), type dropdown (locked for bank-linked cards), points `NumberInput`, inline validation errors, type editor embedding |
| `components/QuizCanvasCardToolbar.tsx` | Active-card action bar (add/duplicate/move/import/delete) — visual-only dock: vertical icon column on desktop/tablet (≥640px), sleek floating glassmorphism bottom pill (backdrop blur, `left/right: 16px`) on mobile (<640px) at `bottom: calc(84px + safe-area)`, dropping to `calc(16px + safe-area)` when Focus Mode hides the bottom nav (`useFocusMode` context, optional `isFocusMode` prop override). Desktop/tablet positioning is owned by `QuizCanvasToolbarLane`'s `toolbarAbsoluteWrapper` (`position: absolute; top: 0` + CSS `translateY` glide); the mobile pill positions itself (`fixed`) with its Focus Mode offsets |
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
- Canvas motion is owned by GSAP & CSS: `Draggable` for drag reorder (direction-aware midpoint crossing swaps with hysteresis; bounded by the whole outer canvas column element (meta card headroom above Q1, question grid, reserved bottom dropzone `BOTTOM_BUFFER = 200`); GSAP re-measures the element bounds into each card's local space on every press, so any card — collapsed or expanded — can swap into any slot end-to-end without forced height clipping; dragging auto-collapses the held card to its compact summary (`COMPACT_HEIGHT = 76`) and re-renders active cards as clean collapsed summaries (`isDragging` → `effectiveIsActive`, no clipped editor) so it glides lightweight through tight compact steps; drag/active card shadows are CSS-owned classes (`cardActive` / `cardDragging`), so GSAP tweens only scale/zIndex and never `box-shadow`, and on release the physical push engine re-expands it to full editor view at its new slot; after a real drag the trailing browser `click` is suppressed for ~150ms, scoped to the dragged card, so dropping never accidentally expands a card; the active-card toolbar is a `toolbarLane` sibling whose position wrapper (`position: absolute; top: 0`) uses the Google Forms Continuous Observation pattern with `ResizeObserver` and `getBoundingClientRect` offset measurement relative to `canvasBody`, gliding via CSS `transform: translateY(...)` with `cubic-bezier(0.2, 0, 0, 1)`), tweens for accordion reflow, and frame-synced physical-push height tweens for expand/collapse (card height animates from its last stable snapshot while `onUpdate` repositions lower cards each frame). Do not reintroduce HTML5 drag-and-drop into `QuizCanvasQuestionList`; keyboard-accessible reordering lives in the active-card toolbar (Move up/down)

## Work Guidance

- Editor symmetry: `QuestionRenderer` (student) ↔ `QuestionEditor` (author), `QuestionStrategy` ↔ `QuestionEditorRegistry`
- New question types require: domain payload, strategy, renderer, editor, and registry entry

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has all its modules in flat subdirectories.
