# src/app/screens/ — Application Screen & Route Composition Layer

## Purpose

Owns the route-level presentation screens, page layouts, and cross-feature capability compositions for Project LunaClair (ADR-014). Screens compose feature presentation components, feature hooks, and domain use cases into cohesive application pages.

## Ownership

- `library/` — Library Home Screen:
  - `LibraryHomeScreen.tsx` — Main dashboard route screen (`/`) displaying local materials and quick stats.
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
  - `CollectionWorkspaceScreen.tsx` — Playlist collection route (`/collections/:collectionId`) with header, `EditCollectionModal` (via `useUpdateCollection`) and `ConfirmationDialog` delete (via `useDeleteCollection` + Library return), Materials/Quizzes tabs (`TabList`: `MaterialCard` grid with remove-from-collection actions vs `CollectionQuizExplorer` with `onStartQuiz` forwarded from `ShellRoutes.handleStartQuiz`).

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
