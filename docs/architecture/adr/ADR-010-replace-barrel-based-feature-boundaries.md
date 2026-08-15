# ADR-010 — Replace Barrel-Based Feature Boundaries

## Status

Accepted

## Introduced

Phase 6 — Application Layer & Domain Boundary Refinement

## Decision Drivers

- ADR-009's barrel-based public contracts became unconsumable once `react-doctor`'s `no-barrel-import` rule flagged every barrel import.
- Keep the boundary intent of ADR-009 — one owning feature per capability, internal paths private — without carrying unimported files.
- Eliminate dead `index.ts` files and the scanner noise they generate.
- Keep enforcement honest: boundaries are documented and manually maintained until dedicated architectural linting exists.

## Context

[ADR-009](ADR-009-feature-ownership-and-public-contracts.md) established feature-root barrels as the public API: cross-feature consumers import only from the owning feature's root `index.ts`. In Aug 2026, `react-doctor`'s `no-barrel-import` rule was resolved project-wide — per user direction, every barrel import was converted to a direct module path, and the resulting cross-feature imports were documented as an explicit allow-list in `src/features/AGENTS.md`.

That refactor left the barrel files themselves with **zero importers**. A dead-code scan (`deslop/unused-file`) flagged them, while the documentation still said barrels are retained as ADR-009 contracts. The Aug 2026 cleanup sweep removed the unimported barrels (44 `index.ts` files, ~1,500 lines). The build stayed green — nothing imported them. This ADR records that decision and reconciles the documentation with the tree.

## Decision

Feature barrels are no longer used as public API boundaries.

1. **Direct imports are the convention.** Cross-feature consumption uses approved direct module paths, listed in `src/features/AGENTS.md` (Local Contracts → no-barrel-import). New cross-feature imports extend that list.
2. **Unimported barrels were removed.** All `index.ts` files with zero importers were deleted in the Aug 2026 sweep. Barrels that remain are those actually consumed by imports — a barrel kept as documentation is a bug, not a contract.
3. **Enforcement is the documented allow-list, not a lint rule.** The list is maintained by hand. Dedicated architectural linting is the intended future enforcement, but no specific tool is committed here — do not read this ADR as implementing one.

## Migration

- Aug 2026: existing barrel imports converted to direct module paths (`react-doctor no-barrel-import` sweep), recorded in the `src/features/AGENTS.md` allow-list.
- Aug 2026: unimported barrels deleted (44 files); ADR-009 marked superseded; this ADR added.

## Alternatives Considered

- **Retain all barrels as documented contracts (ADR-009 status quo):** Preserves a public API surface, but permanently carries 44 files no code imports, keeps them visible to dead-code scanners, and requires hand-maintenance of both barrels and the allow-list.
- **Hybrid — retain curated top-level barrels, delete internal sub-barrels:** More nuanced, but still keeps unimported files and splits the boundary story between barrels and direct paths.
- **Chosen — remove unimported barrels, direct paths + documented allow-list:** One mechanism, no dead files, explicit and auditable contract.

## Consequences

### Positive

- No barrel scanner noise; `react-doctor` is clean.
- ~1,500 lines of dead files removed; documentation matches the tree.
- The public contract is an explicit, auditable allow-list rather than an implicit file convention.
- ADR-009 remains intact as historical record — the "why" of the barrel architecture is preserved.

### Negative / Trade-offs

- Boundary enforcement is manual: nothing but the documented list prevents a new deep import, and the list must be extended by hand when consumption changes.
- Barrel ergonomics are gone — consumers must know the approved direct paths instead of importing a feature root.
- New cross-feature imports require an allow-list update, adding a small review burden.

## Supersedes

- [ADR-009](ADR-009-feature-ownership-and-public-contracts.md) on the question of *how* feature boundaries are exposed. ADR-009's ownership principles — one owning feature per capability, internal privacy, `shared/` stays domain-agnostic — remain in force; only the barrel mechanism is replaced.

## Related ADRs

- [ADR-007](ADR-007-feature-first-architecture.md) — Feature-First Project Module Organization
- [ADR-008](ADR-008-shared-ui-vs-components-layering.md) — Shared UI Primitives vs. Composite Components Layering
- [ADR-009](ADR-009-feature-ownership-and-public-contracts.md) — Feature Ownership and Public Contracts (superseded by this ADR)
