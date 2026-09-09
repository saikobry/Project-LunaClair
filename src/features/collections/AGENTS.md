# src/features/collections/ — Playlist Collections Bounded Context

## Purpose

Owns playlist-model collection presentation and membership state: collection query/mutation hooks and cache keys. Collections group materials via the `collectionMaterials` junction; each collection keeps its own independent material ordering.

## Ownership

- `queries/` — Cache key definitions:
  - `collectionQueryKeys.ts` — Query key factory for the `['collections', ...]` namespace (`lists`, `details`, `detail(id)`, `materials(collectionId)`, `materialCollections(materialId)`, `unassigned`).
- `types/` — Feature contracts:
  - `collectionQuizTree.types.ts` — `CollectionQuizItem` (quiz id, material id, title, question count, optional description) and `CollectionQuizMaterialGroup` (material groups owning quiz items).
- `hooks/` — Collection state hooks (DI via `ApplicationContext`, never concrete infrastructure):
  - `queries/useCollections.ts` — All collections sorted by `order`.
  - `queries/useCollection.ts` — Single collection by ID.
  - `queries/useCollectionMaterials.ts` — Junction-ordered `StudyMaterial[]` for a collection (links via `CollectionMaterialRepository`, materials via `LibraryRepository`, order re-applied after map lookup).
  - `queries/useMaterialCollections.ts` — `Collection[]` + `collectionIds` containing a material.
  - `queries/useUnassignedMaterials.ts` — Materials with zero junction rows.
  - `queries/useCollectionQuizTree.ts` — Quiz tree for a collection: fetches via the `QuizRepository` port (`getQuizzesForMaterials`), groups by material in collection material order, derives counts from `quiz.questionIds.length`. Key: `[...collectionQueryKeys.materials(collectionId), 'quiz-tree']`.
- `components/` — Feature-owned presentation:
  - `CollectionQuizExplorer.tsx` — Quizzes tab explorer: debounced (200ms) title search, material accordion groups with per-material and per-quiz checkboxes, Select All/Deselect All toolbar, `X questions` chips, empty state ("No quizzes available yet in this collection."), and a sticky action bar (`X quizzes · Y questions selected`) emitting single (`type: 'quiz'`) or unified (`type: 'quizzes'`) `QuizLaunchRequest` via `onStartQuiz`.
  - `mutations/useCreateCollection.ts`, `mutations/useUpdateCollection.ts`, `mutations/useDeleteCollection.ts` — Delegate to `useCases.collections.*`, invalidate `collectionQueryKeys.all` (+ `detail(id)` on update).
  - `mutations/useAddMaterialToCollection.ts`, `mutations/useRemoveMaterialFromCollection.ts` — Invalidate `materials(collectionId)`, `materialCollections(materialId)`, `unassigned`.
  - `mutations/useReorderCollectionMaterials.ts` — Invalidates `materials(collectionId)`.
- `modals/` — Self-contained collection dialogs (no hook/query dependencies; all data and callbacks flow in via props):
  - `CreateCollectionModal.tsx` — Create dialog: required title (autofocus, submit disabled when blank), optional description (`TextArea`), soft color preset swatches, and icon selector (`role=radiogroup` semantics; clicking a selected swatch/icon deselects it). Draft resets on reopen via guarded render-phase adjustment. Emits trimmed `title` + optional `description`/`icon`/`color` through `onSave`.
  - `EditCollectionModal.tsx` — Edit dialog pre-filled from the `collection` prop; re-seeds its draft when the modal opens or a different collection is targeted; emits `(id, { title?, description?, icon?, color? })` through `onSave`.
  - `ManageMaterialCollectionsModal.tsx` — Playlist-style material assignment dialog: one `Checkbox` per collection (checked = `assignedCollectionIds.includes(collection.id)`), `onToggle(collectionId, !currentlyAssigned)` per flip with per-row busy dimming while the promise is in flight, empty state ("No collections created yet" + Create Collection button) when no collections exist, footer with `+ Create Collection` and `Done`.
  - `collectionAppearance.ts` — Shared registry mapping persisted plain-string `icon`/`color` values to lucide components (`COLLECTION_ICONS`, `getCollectionIcon`, default Folder) and soft hex swatches (`COLLECTION_COLOR_PRESETS`: Blue, Green, Purple, Amber, Rose, Cyan). Kept out of component files so they stay fast-refresh-clean.

## Local Contracts

- **Directed Dependencies (ADR-014)**: Depends unidirectionally on `materials/` (`MaterialCard`, `LibraryRepository` port, `materialQueryKeys` invalidation scope is separate), plus a type-only dependency on `quiz/types/quizFeature.types` (`QuizLaunchRequest` for the explorer launch contract — no runtime quiz imports, DAG stays acyclic). Must not depend on `app/screens/`.
- Query hooks read through `context.repositories.collection` / `collectionMaterial` / `library`; mutation hooks delegate exclusively to `context.useCases.collections.*`.
- `modals/` are pure presentation: they never import hooks, repositories, or infrastructure — parents own data fetching and pass `collections`, `assignedCollectionIds`, and `onToggle`/`onSave` callbacks. Non-goals in force: never add hook/query imports here; `src/app/routing/` and `ShellRoutes.tsx` are owned elsewhere.
- Route-level workspace orchestration belongs to `src/app/screens/collection-workspace/CollectionWorkspaceScreen.tsx` (mounts `EditCollectionModal`, drives edit/delete mutations). The `ManageMaterialCollectionsModal` is composed in `src/app/screens/library/LibraryModals.tsx` and launched from `MaterialCard`'s `onManageCollections` callback via `LibraryHomeScreen`.
- Shell discovery belongs to `src/app/layouts/navigation/DesktopSidebar.tsx` (`CollectionsNav` mounts `CreateCollectionModal`, navigates to the new collection on save).

## Verification

- `npm run test:run`
- `npm run lint`
- `npm run build`
- `npx vitest run src/features/collections/modals` — colocated modal tests: `CreateCollectionModal.test.tsx` (render, required-title gating, color/icon selection round-trip, cancel/reset) and `ManageMaterialCollectionsModal.test.tsx` (assignment reflection, toggle payloads both directions, empty state, footer actions).

## Child DOX Index

(No child directories with AGENTS.md.)
