# src/shared/ — Shared Code

## Purpose

Truly shared code: reusable domain-agnostic UI primitives, composite components, utility functions, and infrastructure hooks that multiple features may consume. Nothing in `shared/` depends on any feature module or business entity.

## Ownership

| Module | Contents |
|---|---|
| `constants/storageKeys.ts` | `STORAGE_KEYS` nested storage namespace (`lunaclair.*`) — library/reader/settings/session keys incl. `settings.onboardingDone` (first-run tutorial gate) |
| `constants/listRendering.ts` | `VIRTUALIZE_AFTER_ITEM_COUNT` (25) — lists at/below render fully; larger lists virtualize (shelf, materials grid, sidebar nav) |
| `ui/` | Design system primitive adapters and low-level container primitives — includes `Dialog` (native `<dialog>` wrapper over `@astryxdesign/core` with header/content/footer slots), `TagInput`, `EmptyState` (zero-data / filter empty), `ErrorState` (404 / missing entity / offline error), `Skeleton` (`CardGridSkeleton`, `WorkspaceSkeleton`, `QuestionSkeleton`) |
| `components/` | Domain-neutral composites such as `ActionMenu` (ellipsis trigger; popup portaled to `document.body` with trigger-anchored fixed coords — an inline absolute popup gets trapped beneath sibling cards by their hover-lift stacking contexts) |
| `hooks/` | Domain-agnostic UI and infrastructure hooks: `useDraftAutosave` (generic debounce/throttle/blur/unload autosave policy with an injected `persist` callback), `useDebounce` (generic value debouncer), `useMediaQuery` (media-query subscription with SSR/jsdom-safe default), `useStableListKeys` (stable per-row list keys for id-less string rows — never the array index) |
| `utils/` | Domain-agnostic utility functions: `contextGuard` (strict context unwrapping with descriptive missing-provider assertion), `fileDownload` (safe client-side blob download trigger & filename sanitization), `jsonBlobParser` (typed JSON blob parsing) |

## Local Contracts

- Nothing in `shared/` may depend on any feature module.
- Nothing in `shared/` may own or reference business capabilities such as Materials, Collections, or Quizzes.
- Query and mutation hooks, cache key factories, dialogs, and domain-specific composites belong to their owning feature.
- Shared composites must accept domain-neutral props and render without business workflows.
- Zero barrel boundaries (ADR-010): `shared/` has no root or sub-component barrel files (`index.ts`); all consumers import direct module paths (e.g. `shared/ui/Button/Button`, `shared/ui/Card/Card`, `shared/ui/EmptyState/EmptyState`, `shared/ui/ErrorState/ErrorState`, `shared/ui/Input/Input`, `shared/ui/Page/Page`, `shared/components/ActionMenu/ActionMenu`).
- When two features need the same domain-agnostic type/constant/utility, extract it here.
- 1:1 primary test colocation (ADR-012): every shared hook, behavioral utility, and interactive UI primitive/composite must have colocated tests under `__tests__/<UnitName>.test.ts` or `.test.tsx`.

## Work Guidance

- **State Primitives**:
  - Use `<EmptyState />` for zero-data and search/filter no-matches states.
  - Use `<ErrorState />` for 404/not-found, offline unavailable, and error states.
  - Do not force live-region roles (`role="status"` / `role="alert"`) on initial mount; maintain accessible heading depth via `headingLevel`.
  - Use `@astryxdesign/core`-backed `<Skeleton>` variants (`CardGridSkeleton`, `WorkspaceSkeleton`, `QuestionSkeleton`) for full-view loading states instead of raw text strings.
  - Existing feature tabs backfill opportunistically when touched during regular feature work.

## Verification

- `npx vitest run src/shared/` — shared unit tests (hooks, utilities, and interactive UI components)
- `npm run build`
- `npm run lint`

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
