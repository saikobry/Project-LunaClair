# ADR-008 — Shared UI Primitives vs. Composite Components Layering

## Status
Accepted

## Introduced
Phase 5 — Assessment Engine Foundation

## Decision Drivers
- Preserving a clean abstraction layer over `@astryxdesign/core` design system primitives.
- Preventing primitive wrappers from leaking composite-domain styling or behavior.
- Clear developer intuition: `ui/` = thin 1-to-1 Astryx adapters, `components/` = multi-element composites.
- Avoiding a monolithic `ui/` barrel that mixes low-level atoms with higher-level composition.

## Context

`src/shared/ui/` originally contained a mix of:

- **Design system primitive wrappers** — thin 1-to-1 adapters around `@astryxdesign/core` (Button, Card, Input, Dialog, Breadcrumbs, SegmentedControl, TabList, Chip, Skeleton, Toast).
- **Composite shared components** — multi-element components built from primitives plus domain styling (MaterialCard, TermGroupedSelector, SelectableRow).

This conflation muddled the purpose of `ui/`. A developer looking for low-level primitives had to sift through composite components, and composites had no clear home of their own.

## Decision

We split `src/shared/` into two subdirectories:

| Directory | Purpose | Examples |
|---|---|---|
| `src/shared/ui/` | **Design system primitive adapters** — thin, 1-to-1 wrappers around `@astryxdesign/core` components. No composite logic, no domain-specific layout. | Button, Card, Input, Dialog, Breadcrumbs, SegmentedControl, TabList, Chip, Skeleton, Toast |
| `src/shared/components/` | **Composite / multi-element shared components** — built from primitives and possibly domain types, but still feature-agnostic and reusable across features. | MaterialCard, TermGroupedSelector, SelectableRow |

### Rules

1. `ui/` components must not import from `components/`.
2. `components/` may import from `ui/`, `shared/hooks/`, `shared/types/`, and `domain/` (types only).
3. `components/` must not import from `features/` or `app/`.
4. Neither `ui/` nor `components/` may depend on each other's specific internals (only barrel exports).

## Alternatives Considered

- **Keep everything in `ui/`**: Simplifies barrel exports but creates cognitive overhead — no clear signal whether a component is a primitive adapter or a composite.
- **Keep everything in `components/`**: Flattens the hierarchy but buries the fact that some components are thin framework wrappers and others are hand-crafted composites.
- **Deeper nesting (atoms/molecules/organisms)**: Over-engineered for LunaClair's current scope; this pattern fits design-system libraries, not application code.

## Consequences

### Positive
- Clear developer intuition about where to find or place a component.
- `ui/` barrel stays small and focused on Astryx adaptation surface.
- `components/` barrel grows independently as shared composites are extracted.
- Easier to audit whether a primitive wrapper is leaking domain behavior.

### Negative / Trade-offs
- Two barrel files to maintain instead of one.
- Some consumers need to update import paths from `shared/ui/` to `shared/components/`.

## Related ADRs
- [ADR-007](ADR-007-feature-first-architecture.md) — Feature-First Project Module Organization
