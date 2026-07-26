# src/shared/ — Shared Code

## Purpose

Truly shared code: reusable types, constants, utility functions, and base UI components that multiple features may consume. Nothing in `shared/` depends on any feature module.

## Ownership

| Module | Contents |
|---|---|
| `types/annotation.types.ts` | `HighlightItem`, `DrawingPath`, `Point`, `HighlightColor`, `AnnotationMode`, `DrawingTool` |
| `constants/storageKeys.ts` | `STORAGE_KEYS` nested domain-scoped map (`lunaclair.*` namespace) + `LEGACY_STORAGE_KEYS` for migration |
| `constants/annotationDefaults.ts` | `BRUSH_COLORS`, `THICKNESS_OPTIONS`, `HIGHLIGHT_COLORS` |
| `utils/selection.ts` | `getOffsetsOfRange()`, `restoreRange()` — DOM Range ↔ character offset utilities |
| `styles/tokens.stylex.ts` | Minimal StyleX design tokens (spacing, radius, shadow, transition) |
| `ui/` | LunaClair UI primitives (Button, Card, Dialog, Input, Page) — thin Astryx adapters |
| `components/` | Reserved for shared composite components |
| `hooks/` | Reserved for shared custom hooks |

## Local Contracts

- Nothing in `shared/` may depend on any feature module.
- Barrel exports via `index.ts` — re-export selectively.
- When two features need the same type/constant/utility, extract it here.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
