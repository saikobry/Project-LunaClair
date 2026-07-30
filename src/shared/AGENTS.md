# src/shared/ — Shared Code

## Purpose

Truly shared code: reusable types, constants, utility functions, and base UI components that multiple features may consume. Nothing in `shared/` depends on any feature module.

## Ownership

| Module | Contents |
|---|---|
| `types/annotation.types.ts` | `HighlightItem`, `DrawingPath`, `Point`, `HighlightColor`, `AnnotationMode`, `DrawingTool` |
| `constants/storageKeys.ts` | `STORAGE_KEYS` nested domain-scoped map (`lunaclair.*` namespace) |
| `constants/annotationDefaults.ts` | `BRUSH_COLORS`, `THICKNESS_OPTIONS`, `HIGHLIGHT_COLORS` |
| `utils/selection.ts` | `getOffsetsOfRange()`, `restoreRange()` — DOM Range ↔ character offset utilities |
| `styles/tokens.stylex.ts` | Minimal StyleX design tokens (spacing, radius, shadow, transition) |
| `ui/` | Design system primitive adapters — thin, 1-to-1 wrappers around `@astryxdesign/core` and low-level container primitives (Button, Card, Dialog, Input, Page, Breadcrumbs, Toast, Skeleton, TabList, SegmentedControl, Chip, AnimatedTabPanel) |
| `components/` | Composite / multi-element shared components built from primitives (MaterialCard, ActionMenu, TermGroupedSelector, SelectableRow) |
| `hooks/` | Reusable shared custom hooks (`useSubject`, `useTerms`, `useMaterial`, `useTermGroupedSelection`, etc.) |

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
