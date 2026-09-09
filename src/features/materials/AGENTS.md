# src/features/materials/ — Study Materials Bounded Context

## Purpose

Owns the core study material entity presentation and local library state management: material cards, grids, creation/edit modals, delete confirmations, and library query hooks. Represents a foundational leaf bounded context with zero dependencies on other features.

## Ownership

- `components/` — Material presentation components:
  - `MaterialCard.tsx` — Individual study material card with subject badge, term chip, `#tag` chips (when `material.tags` is non-empty), and action menu.
  - `MaterialGrid.tsx` — Grid container for study material cards.
  - `SubjectCardGrid.tsx` — Grouped material cards by subject.
  - `LibraryView.tsx` — Pure presentation view for the user's local study materials library.
- `modals/` — Material creation and modification dialogs:
  - `CreateMaterialModal.tsx` — Modal for creating a new study material (accepts `subjects` and `terms` as props; tags via shared `TagInput`, emitted through the 5th `onSave` argument as `normalizeTags(tags)`).
  - `EditMaterialModal.tsx` — Modal for editing material title, description, subject, term, and tags (`initialTags` prop, shared `TagInput`). Emits `normalizeTags(tags) ?? []` so an emptied tag list CLEARS tags rather than leaving them unchanged.
  - `DeleteConfirmationModal.tsx` — Confirmation dialog for deleting a study material.
- `hooks/` — Material state & persistence hooks:
  - `queries/useLibrary.ts` — Query hook for all local study materials.
  - `queries/useMaterial.ts` — Query hook for a single study material by ID.
  - `mutations/useCreateMaterial.ts` — Mutation hook delegating to `CreateMaterialUseCase`.
  - `mutations/useEditMaterial.ts` — Mutation hook delegating to `UpdateMaterialUseCase`.
  - `mutations/useDeleteMaterial.ts` — Mutation hook delegating to `DeleteMaterialUseCase`.
  - `mutations/useTouchMaterial.ts` — Mutation hook updating material's `lastOpenedAt`.
  - `useLibraryRepository.ts` — DI context accessor for `LibraryRepository`.
- `queries/` — Cache key definitions:
  - `materialQueryKeys.ts` — Query key factory for library materials (`['library', 'materials']`, `['library', 'material', id]`).
- `styles/` — StyleX styles:
  - `library.stylex.ts` — Shared StyleX styles for material cards and dialogs.

## Local Contracts

- **Leaf Bounded Context (ADR-014)**: `features/materials` has 0 cross-feature dependencies. It must never import from `subjects/`, `terms/`, `discovery/`, or other features.
- Modals accept related domain models (`Subject[]`, `Term[]`) as props from calling screens rather than querying them directly.
- Mutation hooks delegate exclusively to `src/application/` use cases.
- Route-level library pages belong to `src/app/screens/library/` (e.g. `LibraryHomeScreen.tsx`, `LibraryModals.tsx`).

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run`
- `npm run lint`
- `npm run build`

## Child DOX Index

(No child directories with AGENTS.md.)
