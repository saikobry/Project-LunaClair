# src/app/screens/ — Application Screen & Route Composition Layer

## Purpose

Owns the route-level presentation screens, page layouts, and cross-feature capability compositions for Project LunaClair (ADR-014). Screens compose feature presentation components, feature hooks, and domain use cases into cohesive application pages.

## Ownership

- `library/` — Library Home Screen:
  - `LibraryHomeScreen.tsx` — Main dashboard route screen (`/`) displaying local materials and quick stats. Unfiled mode (`unfiledOnly`, route `/unfiled`) displays only unassigned materials via `useUnassignedMaterials` with the "Unfiled" title and cleared-unfiled empty state.
  - `LibraryModals.tsx` — Composed dialog container managing material creation/edit and collection assignment modals.
- `material-workspace/` — Material Workspace Screen:
  - `MaterialWorkspaceScreen.tsx` — Material workspace route (`/materials/:materialId`) with Read, Write, Quiz, Flashcards, and Manage tabs.
- `explore/` — Explore Hub Screen:
  - `ExploreScreen.tsx` — Content discovery route (`/explore`), shares-only: one unified card list of published `.lcpack` shares (verified/community badge, exact `originShareId` clone identity, 1-click cloning). No catalog section and no source filter; `onOpenMaterial` remains an optional no-op-compatible prop for route wiring.
- `quiz-session/` — Quiz Session Runner Screen:
  - `QuizSessionScreen.tsx` — Active quiz taking route (`/quiz/session/:id`) hosting the live quiz evaluation runner.
- `quiz-canvas/` — Quiz Canvas Builder Screen:
  - `QuizCanvasBuilderScreen.tsx` — Thin routing wrapper hosting the interactive quiz authoring canvas.
- `analytics/` — Learning Analytics Screen:
  - `AnalyticsScreen.tsx` — Learning insights and study statistics dashboard route (`/analytics`).
- `importer/` — Document Importer Screen:
  - `ImporterScreen.tsx` — 5-step document import wizard route (`/importer`).
- `shared-package/` — Shared Package Screen:
  - `SharedPackageScreen.tsx` — Cloud package inspection and import route (`/share/:shareId`, `/s/:code`).
- `collection-workspace/` — Collection Workspace Screen:
  - `CollectionWorkspaceScreen.tsx` — Playlist collection route (`/collections/:collectionId`) with `CollectionHero` (inline-editable title/description wired to `useUpdateCollection`, stats row, Quick Study over all tree quizzes via `onStartQuiz`, Edit/Delete actions), `CollectionMaterialList`, `AddMaterialsDrawer`, and a Quizzes tab with `CollectionQuizExplorer` (floating glass action bar with single/unified practice launch). The Quizzes tab is nav-aware through `useFocusMode`, so tests that render this screen must wrap it in `FocusModeProvider` (in the app the provider comes from `AppShell`).
  - `CollectionMaterialList.tsx` — Thin composer for the playlist list view: mirrors the `materials` prop into optimistic local order (render-phase adjustment, so it survives re-fetches) and renders `CollectionMaterialRow` per material plus the hold-to-drag progress-ring SVG.
  - `CollectionMaterialRow.tsx` — One playlist row: drag handle, step number, open-title `<button>`, tags, mastery bar, and up/down/remove controls. `data-material-id` and `data-drag-handle="true"` are the DOM contract the reorder hook queries. Responsive reductions: drag handle hidden `< 640px`, step numbering and mastery bar hidden `< 1024px`, arrows stacked vertically `< 640px`.
  - `useCollectionMaterialReorder.ts` — GSAP reorder engine: `Draggable` instances with real-time sibling displacement, 15px slot hysteresis, subpixel-antialiasing flicker elimination, smooth landing snap, and the mobile 280ms hold-to-drag gesture (circular progress ring centered at the touch point plus row border illumination) used when the drag handle is hidden. Owns the teardown of every row listener and in-flight hold timer it registers; surfaces `listRef` / `holdRingRef` / `holdCircleRef` / `moveItem` and commits order through `onReorder` (`useReorderCollectionMaterials`). Its hold timer is a rule-documented `react-doctor/effect-needs-cleanup` false positive (the timer is created inside the `pointerdown` handler the effect only defines and attaches), suppressed in `doctor.config.ts` via a scoped `ignore.overrides` entry — do not "fix" it by adding top-level timer wrapping. See `.react-doctor/false-positives.md`.
  - `collectionMaterialList.stylex.ts` — StyleX rules shared by the list and its row (project `*.stylex.ts` convention).
  - `AddMaterialsDrawer.tsx` — Library search-and-add slide-over rendered as a **native modal `<dialog>`** (`showModal()`) portalled to `document.body`, anchored to the right edge with a blurred `::backdrop`. Search uses the shared `Input` (`startIcon` + `clearable`) like Library/Explore/QuizExplorer so styling stays consistent. Body scroll is locked (`overflow: hidden`, restored on close) while open so the main-page scrollbar hides. Escape is handled twice: natively through the dialog's `cancel` event plus a document `keydown` fallback (covers a non-modal render, where `cancel` never fires), with `onClose` read through a `useEffectEvent` so neither dismissal listener re-subscribes on parent redraws; backdrop clicks are bound to the dialog element imperatively; mounted only while open. The style block deliberately overrides the UA dialog defaults — `height: auto` (so the `top`/`bottom` pair keeps the full-viewport-height stretch instead of collapsing to the UA `fit-content`), `overflow: visible`, zero padding, zero padding-side borders, and `max-height: none` — so the panel stays geometrically identical to the previous `role="dialog"` markup. Reports added materials through `onMaterialAdded`.

## Local Contracts

- **Screen Layer Exclusivity (ADR-014)**: Features must never own route screens; all route screens live here.
- **Cross-Feature Composition**: When an interaction requires multiple domain capabilities (e.g. collection workspace coordinating collections and materials), the composition occurs in this screen layer.
- Screens consume features strictly via direct module paths (ADR-010). Features must not import from `src/app/screens/`.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run`
- `npm run lint`
- `npm run build`

## Child DOX Index

(No child directories with AGENTS.md.)
