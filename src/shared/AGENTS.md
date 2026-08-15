# src/shared/ — Shared Code

## Purpose

Truly shared code: reusable domain-agnostic UI primitives, composite components, utility functions, and infrastructure hooks that multiple features may consume. Nothing in `shared/` depends on any feature module or business entity.

## Ownership

| Module | Contents |
|---|---|
| `constants/storageKeys.ts` | `STORAGE_KEYS` nested storage namespace (`lunaclair.*`) — library/reader/settings/session keys incl. `settings.onboardingDone` (first-run tutorial gate) |
| `ui/` | Design system primitive adapters and low-level container primitives — includes `TagInput` (tag/chip input: type+Enter or comma/paste bulk entry, removable `#tag` tokens, output normalized through the domain `tags.ts` helpers) |
| `components/` | Domain-neutral composites such as `ActionMenu` |
| `hooks/` | Domain-agnostic UI and infrastructure hooks: `useDraftAutosave` (generic debounce/throttle/blur/unload autosave policy with an injected `persist` callback), `useDebounce` (generic value debouncer), `useStableListKeys` (stable per-row list keys for id-less string rows — never the array index) |

## Local Contracts

- Nothing in `shared/` may depend on any feature module.
- Nothing in `shared/` may own or reference business capabilities such as Subjects, Materials, Terms, or Quizzes.
- Query and mutation hooks, cache key factories, dialogs, and domain-specific composites belong to their owning feature.
- Shared composites must accept domain-neutral props and render without business workflows.
- No barrel boundaries (ADR-010): `shared/` has no root barrel; consumers import direct module paths (e.g. `shared/ui/Button/Button`).
- When two features need the same domain-agnostic type/constant/utility, extract it here.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
