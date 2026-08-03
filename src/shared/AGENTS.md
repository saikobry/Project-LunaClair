# src/shared/ — Shared Code

## Purpose

Truly shared code: reusable domain-agnostic UI primitives, composite components, utility functions, and infrastructure hooks that multiple features may consume. Nothing in `shared/` depends on any feature module or business entity.

## Ownership

| Module | Contents |
|---|---|
| `types/annotation.types.ts` | Shared annotation value shapes used by reader and persistence contracts |
| `constants/storageKeys.ts` | `STORAGE_KEYS` nested storage namespace (`lunaclair.*`) |
| `constants/annotationDefaults.ts` | `BRUSH_COLORS`, `THICKNESS_OPTIONS`, `HIGHLIGHT_COLORS` |
| `utils/selection.ts` | `getOffsetsOfRange()`, `restoreRange()` — DOM Range ↔ character offset utilities |
| `styles/tokens.stylex.ts` | Minimal StyleX design tokens (spacing, radius, shadow, transition) |
| `ui/` | Design system primitive adapters and low-level container primitives |
| `components/` | Domain-neutral composites such as `ActionMenu` and `SelectableRow` |
| `hooks/` | Domain-agnostic UI and infrastructure hooks such as `useTabKeyboardNavigation` |

## Local Contracts

- Nothing in `shared/` may depend on any feature module.
- Nothing in `shared/` may own or reference business capabilities such as Subjects, Materials, Terms, or Quizzes.
- Query and mutation hooks, cache key factories, dialogs, and domain-specific composites belong to their owning feature.
- Shared composites must accept domain-neutral props and render without business workflows.
- Barrel exports via `index.ts` — re-export selectively.
- When two features need the same domain-agnostic type/constant/utility, extract it here.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
