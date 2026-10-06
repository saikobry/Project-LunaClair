# src/features/materials/ — Study Materials Bounded Context

## Purpose

Owns the core study material entity presentation and local library state management: material cards, grids, creation/edit modals, delete confirmations, and library query hooks. Represents a foundational leaf bounded context with zero dependencies on other features.

## Ownership

- `components/` — Material presentation components:
  - `MaterialFormFields.tsx` — Presentational form fields for material creation and editing (Title `Input`, Description `TextArea`, and `TagInput` with normalized tag tokens and StyleX vertical rhythm).
  - `MaterialCard.tsx` — Individual study material card: its filing and tag rows, popovers, actions, and extracted subcomponents.
    - **Card rhythm.** A full-height shell with reserved block heights and badges pinned so rows align, a compact description, and a bordered-top footer with recency + a promoted Quiz button.
    - **Fitted rows.** Width-fitted `#tag` and collection rows stay on a single line each — a hidden probe row + `useFittedCount` measure what fits and collapse the rest into `+N`, so rows overflow only at the width limit and never strand a lone `+N`.
      - **Tag overflow.** Tag `+N` is highlighted while a hidden tag is filtered and opens the All-tags viewer.
      - **Badge overflow.** Badge `+N` opens the filing popover.
      - **Library tag filtering.** Tags join the library filter via optional `onToggleTag`/`selectedTags`; static chips where unwired.
    - **Filing trigger.** The inline filing trigger sits beside the badges, or shows a "Not in a collection yet" indicator.
    - **Action menu.** Open, Start quiz, Manage questions, Organize, Edit, Remove.
    - **Portal rendering.** Both popovers render through a `document.body` portal with card-shell-aligned fixed positioning, so they escape grid rows and virtualized-row transforms instead of sliding under the next row.
      - **Anchor and repositioning.** Anchor = trigger/row rect; flip + scroll/resize reposition.
    - **Sole assignment surface.** The filing popover is the **sole** material-to-collection assignment surface (owner: `src/features/collections/AGENTS.md`): it stays open across toggles so one material can be filed into several collections in a single pass, and each row is `disabled` + `aria-busy` while its mutation is in flight to prevent double-fire.
    - **Popover dismissal.** Popovers never close on toggle — only on outside-click, Escape, or their close button.
    - **Pointer opening.** The shell opens on body click for pointer users (a `closest` + popover-container guard keeps badge/filing/menu/tag clicks from double-firing).
    - **Keyboard and AT opening.** The shell deliberately has no `role="button"` — nested buttons inside a button role is invalid ARIA — so keyboard/AT opening lives in the title `<button>` and the menu's Open item.
    - **Interaction false positive.** The body-click handler is a rule-documented `react-doctor/no-static-element-interactions` exception, scoped in `doctor.config.ts` (see `.react-doctor/false-positives.md`).
    - **Hover lift.** The affordance is two-part and deliberately split by element: the inner shell lifts (`cardStyles.interactive`) while the border emphasis (`cardStyles.cardHoverBorder` → `--color-accent`, matching the lift) is applied to the `Card` surface through the shared adapter's `xstyle`.
      - **Border ownership.** The border belongs to `Card`; styling the shell would draw a second box inside it.
    - **Extracted subcomponents.** Internal `MaterialCollectionsPopover` / `MaterialCollectionBadges` / `MaterialTagPill` / `MaterialTagRow` / `MaterialTagsPopover` / `MaterialCardFooter` / `PopoverHeader` components, plus the `usePopoverPosition` / `useCardOverlays` hooks and the `CollectionsPortal` / `TagsPortal` shells, hold the extracted branches.
  - `MaterialGrid.tsx` — Grid container for study material cards; threads the optional `onManage` callback from LibraryView to each card. Past `VIRTUALIZE_AFTER_ITEM_COUNT` it swaps to `VirtualMaterialGrid` (window-virtualized aligned rows, lanes from measured container width matching the `auto-fill/minmax(280px)` formula, rows measured live) and skips the GSAP stagger — recycled rows and enter-animations fight each other.
  - `LibraryView.tsx` — Library **materials section**: the filter bar, the material grid, and the three zero-result states. Renders no page chrome — `LibraryScreen` owns `<Page>` and composes the Collections shelf above it. Optional `limit` caps the rendered cards while the header count reflects the full list (the screen's overview stepper owns growing it). Internal `LibraryFilterBar` (shared `SearchInput` + a membership lens group + faceted tag pills capped at 8 with a `+N more` expander, selected pills always visible, OR within the tag facet (AND across search/membership/tags); tags arrive faceted + frequency-ranked from the screen's search+membership base; tag membership resolved against one `Set`) and `LibraryEmptyStates` subcomponents hold the extracted branches. `LibraryEmptyStates` covers, in priority order: an empty library (Explore CTA), a cleared `uncollected` lens ("Everything has a home." → reset to `all`), and an over-narrow search/tag filter (Clear filters). Threads the optional `onManage` and `onNavigate` callbacks plus the tag-filter toggle (`onToggleTag`/`selectedTags`, so card tags join the filter) to `MaterialGrid` — `onNavigate` is what makes the card collection badges interactive.
  - `components/materialCard.stylex.ts` — StyleX rules for the material card shell, the tag chips (`tagChip`, `tagButton`, `tagButtonActive`, `tagsRow`), the overflow viewer, and the filing/tags popovers. **The tag-chip toggle rules are mirrored by `features/quiz-management/components/questionBank.stylex.ts` (its `tag` / `tagPressed`) as a duplicated rule set, not an import** — a StyleX rule set is not a feature contract, and `quiz-management` takes no `materials` edge to reach one. This file owns the look; **the two sets must move together**, and both owners know it (see Local Contracts).
- `modals/` — Material creation and modification dialogs:
  - `CreateMaterialModal.tsx` — Modal for creating a new study material (composes `MaterialFormFields`, tags emitted through the 3rd `onSave` argument as `normalizeTags(tags)`).
  - `EditMaterialModal.tsx` — Modal for editing material title, description, and tags (`initialTags` prop, composes `MaterialFormFields`). Emits `normalizeTags(tags) ?? []` so an emptied tag list CLEARS tags rather than leaving them unchanged.
  - `RemoveMaterialModal.tsx` — The **only** material removal confirmation. Its copy is part of the contract: it names what the cascade empties (document, questions and quizzes, the files stored with it, collection membership) and then branches on provenance — a cloned material (`originShareId`) is offered re-cloning from Explore while stating that local edits are not part of the share, and a material created on this device is stated as unrestorable. Never reduce it to a bare "cannot be undone": that was false for clones and silent about scope. Also mirrored by `MaterialCard`'s action-menu row, which branches `description` the same way.
- `hooks/` — Material state & persistence hooks:
  - `queries/useLibrary.ts` — Query hook for all local study materials. Re-applies the authored `order` in memory (Dexie returns primary-key order, so `seed-m-10` would sort before `seed-m-2`; unordered rows sort last, stably).
  - `queries/useMaterial.ts` — Query hook for a single study material by ID.
  - `mutations/useCreateMaterial.ts` — Mutation hook delegating to `CreateMaterialUseCase`.
  - `mutations/useEditMaterial.ts` — Mutation hook delegating to `UpdateMaterialUseCase`.
  - `mutations/useRemoveMaterial.ts` — Mutation hook for the **only** material removal path — delegates to `RemoveMaterialUseCase` (the atomic cascade) with optimistic cache removal, and on settle invalidates the materials list, the material's own detail key (a sibling namespace, NOT a child of `materialQueryKeys.all`), plus the `questions` / `quizzes` / `assessment` / `collections` / `analytics` prefixes, because the cascade reaches past the materials store. There is no row-only removal hook, because there is no row-only removal use case.
  - `mutations/useTouchMaterial.ts` — Mutation hook updating material's `lastOpenedAt`.
  - `useLibraryRepository.ts` — DI context accessor for `LibraryRepository`.
- `queries/` — Cache key definitions:
  - `materialQueryKeys.ts` — Query key factory for library materials (`['library', 'materials']`, `['library', 'material', id]`).
- `types/` — Feature contracts:
  - `libraryFilter.types.ts` — `MaterialMembershipFilter` (`'all' | 'collected' | 'uncollected'`), the `MATERIAL_MEMBERSHIP_FILTERS` list, and the `isMaterialMembershipFilter` narrower. Owned here because it filters the materials list; `src/app/routing/routing.ts` imports it for URL parsing, keeping the dependency direction app → feature.
- `styles/` — StyleX styles:
  - `library.stylex.ts` — Shared StyleX styles for material cards and dialogs.

## Local Contracts

- **Cross-feature dependencies (corrected Sep 2026)**: `features/materials` **does** consume `features/collections` — `MaterialCard`'s filing popover is the sole material-to-collection assignment surface and reads `useCollections` / `useMaterialCollections` with `useAddMaterialToCollection` / `useRemoveMaterialFromCollection`. This is the repository's only materials⇄collections edge and it runs **one way** (`collections` imports nothing from `materials`), so the DAG stays acyclic. The previous "0 cross-feature dependencies" claim did not match the code. It must never import from `discovery/`.
- Mutation hooks delegate exclusively to `src/application/` use cases.
- **One material removal contract**: removal goes through `useRemoveMaterial` → `RemoveMaterialUseCase` → the atomic cascade. Never add a second removal path (a row-only removal strands questions, quizzes, document content, collection membership, and stored assets).
- **The verb is `Remove from Library`, never `Delete`.** The local data goes, but a cloned material's published share does not — it stays available in Explore, so "Delete" would promise something the app cannot deliver. Collections are still **deleted** (they exist only on this device) and membership is **removed from a collection** (the material stays). Copy rule: a destructive confirmation names what is deleted and what can be recovered. See `docs/architecture/ui-guidelines.md` (Removal vs Delete Vocabulary).
- **The material card's tag-chip rules are duplicated, deliberately, in `quiz-management`.** `materialCard.stylex.ts` (`tagButton` / `tagButtonActive` / `tagsRow`) and `quiz-management/components/questionBank.stylex.ts` (`tag` / `tagPressed` / `tagsRow`) hold the same treatment as two rule sets because a StyleX rule set is not a feature contract and neither feature may import the other for it. This side owns the look; a change to these rules here must be reflected there. The Bank's row wraps where this card's row fits one measured line, so its chips add `maxWidth` / `overflowWrap` — a deliberate local difference, not drift.
- Route-level library pages belong to `src/app/screens/library/` (`LibraryScreen.tsx`, `LibraryModals.tsx`); the Home dashboard lives in `src/app/screens/home/`. `LibraryView` is a section, not a page — it must not reintroduce `<Page>` chrome.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run`
- `npm run lint`
- `npm run build`

## Child DOX Index

(No child directories with AGENTS.md.)
