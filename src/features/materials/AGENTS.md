# src/features/materials/ — Study Materials Bounded Context

## Purpose

Owns the core study material entity presentation and local library state management: material cards, grids, creation/edit modals, delete confirmations, and library query hooks. Represents a foundational leaf bounded context with zero dependencies on other features.

## Ownership

- `components/` — Material presentation components:
  - `MaterialCard.tsx` — Individual study material card with `#tag` chips (when `material.tags` is non-empty), and action menu (Edit, Delete, and optional `onManageCollections` for collection assignment).
  - `MaterialGrid.tsx` — Grid container for study material cards; threads optional `onManageCollections` callback from LibraryView to each card.
  - `LibraryView.tsx` — Pure presentation view for the user's local study materials library; threads optional `onManageCollections` to MaterialGrid.
- `modals/` — Material creation and modification dialogs:
  - `CreateMaterialModal.tsx` — Modal for creating a new study material (tags via shared `TagInput`, emitted through the 3rd `onSave` argument as `normalizeTags(tags)`).
  - `EditMaterialModal.tsx` — Modal for editing material title, description, and tags (`initialTags` prop, shared `TagInput`). Emits `normalizeTags(tags) ?? []` so an emptied tag list CLEARS tags rather than leaving them unchanged.
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

- **Leaf Bounded Context (ADR-014)**: `features/materials` has 0 cross-feature dependencies. It must never import from `discovery/` or other features.
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
