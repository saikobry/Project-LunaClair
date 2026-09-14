# src/features/materials/ — Study Materials Bounded Context

## Purpose

Owns the core study material entity presentation and local library state management: material cards, grids, creation/edit modals, delete confirmations, and library query hooks. Represents a foundational leaf bounded context with zero dependencies on other features.

## Ownership

- `components/` — Material presentation components:
  - `MaterialCard.tsx` — Individual study material card (uniform rhythm: full-height shell with reserved block heights and badges pinned so rows align, compact description, bordered-top footer with recency + promoted Quiz button) with width-fitted `#tag` and collection rows (single line each — a hidden probe row + `useFittedCount` measure what fits and collapse the rest into `+N`, so rows overflow only at the width limit and never strand a lone `+N`; tag `+N` is highlighted while a hidden tag is filtered and opens the All-tags viewer; badge `+N` opens the filing popover; tags join the library filter via optional `onToggleTag`/`selectedTags`, static chips where unwired), inline filing trigger beside the badges (or "Not in a collection yet" indicator), and action menu (Open, Start quiz, Manage questions, Organize, Edit, Delete). Both popovers render through a `document.body` portal with card-shell-aligned fixed positioning (anchor = trigger/row rect, flip + scroll/resize reposition) so they escape grid rows and virtualized-row transforms instead of sliding under the next row. The filing popover is the **sole** material-to-collection assignment surface: it stays open across toggles so one material can be filed into several collections in a single pass, and each row is `disabled` + `aria-busy` while its mutation is in flight to prevent double-fire. Popovers never close on toggle — only on outside-click, Escape, or their close button. The shell opens on body click for pointer users (a `closest` + popover-container guard keeps badge/filing/menu/tag clicks from double-firing) with deliberately no `role="button"` — nested buttons inside a button role is invalid ARIA, so keyboard/AT opening lives in the title `<button>` and the menu's Open item (rule-documented `react-doctor/no-static-element-interactions` exception, scoped in `doctor.config.ts` — see `.react-doctor/false-positives.md`). Internal `MaterialCollectionsPopover` / `MaterialCollectionBadges` / `MaterialTagPill` / `MaterialTagRow` / `MaterialTagsPopover` / `MaterialCardFooter` / `PopoverHeader` subcomponents plus the `usePopoverPosition` / `useCardOverlays` hooks and the `CollectionsPortal` / `TagsPortal` shells hold the extracted branches.
  - `MaterialGrid.tsx` — Grid container for study material cards; threads the optional `onManage` callback from LibraryView to each card. Past `VIRTUALIZE_AFTER_ITEM_COUNT` it swaps to `VirtualMaterialGrid` (window-virtualized aligned rows, lanes from measured container width matching the `auto-fill/minmax(280px)` formula, rows measured live) and skips the GSAP stagger — recycled rows and enter-animations fight each other.
  - `LibraryView.tsx` — Library **materials section**: the filter bar, the material grid, and the three zero-result states. Renders no page chrome — `LibraryScreen` owns `<Page>` and composes the Collections shelf above it. Optional `limit` caps the rendered cards while the header count reflects the full list (the screen's overview stepper owns growing it). Internal `LibraryFilterBar` (search + a membership lens group + faceted tag pills capped at 8 with a `+N more` expander, selected pills always visible, OR within the tag facet (AND across search/membership/tags); tags arrive faceted + frequency-ranked from the screen's search+membership base; tag membership resolved against one `Set`) and `LibraryEmptyStates` subcomponents hold the extracted branches. `LibraryEmptyStates` covers, in priority order: an empty library (Explore CTA), a cleared `uncollected` lens ("Everything has a home." → reset to `all`), and an over-narrow search/tag filter (Clear filters). Threads the optional `onManage` and `onNavigate` callbacks plus the tag-filter toggle (`onToggleTag`/`selectedTags`, so card tags join the filter) to `MaterialGrid` — `onNavigate` is what makes the card collection badges interactive.
- `modals/` — Material creation and modification dialogs:
  - `CreateMaterialModal.tsx` — Modal for creating a new study material (tags via shared `TagInput`, emitted through the 3rd `onSave` argument as `normalizeTags(tags)`).
  - `EditMaterialModal.tsx` — Modal for editing material title, description, and tags (`initialTags` prop, shared `TagInput`). Emits `normalizeTags(tags) ?? []` so an emptied tag list CLEARS tags rather than leaving them unchanged.
  - `DeleteConfirmationModal.tsx` — Confirmation dialog for deleting a study material.
- `hooks/` — Material state & persistence hooks:
  - `queries/useLibrary.ts` — Query hook for all local study materials. Re-applies the authored `order` in memory (Dexie returns primary-key order, so `seed-m-10` would sort before `seed-m-2`; unordered rows sort last, stably).
  - `queries/useMaterial.ts` — Query hook for a single study material by ID.
  - `mutations/useCreateMaterial.ts` — Mutation hook delegating to `CreateMaterialUseCase`.
  - `mutations/useEditMaterial.ts` — Mutation hook delegating to `UpdateMaterialUseCase`.
  - `mutations/useDeleteMaterial.ts` — Mutation hook delegating to `DeleteMaterialUseCase`.
  - `mutations/useTouchMaterial.ts` — Mutation hook updating material's `lastOpenedAt`.
  - `useLibraryRepository.ts` — DI context accessor for `LibraryRepository`.
- `queries/` — Cache key definitions:
  - `materialQueryKeys.ts` — Query key factory for library materials (`['library', 'materials']`, `['library', 'material', id]`).
- `types/` — Feature contracts:
  - `libraryFilter.types.ts` — `MaterialMembershipFilter` (`'all' | 'collected' | 'uncollected'`), the `MATERIAL_MEMBERSHIP_FILTERS` list, and the `isMaterialMembershipFilter` narrower. Owned here because it filters the materials list; `src/app/routing/routing.ts` imports it for URL parsing, keeping the dependency direction app → feature.
- `styles/` — StyleX styles:
  - `library.stylex.ts` — Shared StyleX styles for material cards and dialogs.

## Local Contracts

- **Leaf Bounded Context (ADR-014)**: `features/materials` has 0 cross-feature dependencies. It must never import from `discovery/` or other features.
- Mutation hooks delegate exclusively to `src/application/` use cases.
- Route-level library pages belong to `src/app/screens/library/` (`LibraryScreen.tsx`, `LibraryModals.tsx`); the Home dashboard lives in `src/app/screens/home/`. `LibraryView` is a section, not a page — it must not reintroduce `<Page>` chrome.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run`
- `npm run lint`
- `npm run build`

## Child DOX Index

(No child directories with AGENTS.md.)
