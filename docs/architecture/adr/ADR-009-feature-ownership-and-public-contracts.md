# ADR-009 — Feature Ownership and Public Contracts

## Status

Superseded by [ADR-010](ADR-010-replace-barrel-based-feature-boundaries.md)

## Introduced

Phase 6 — Application Layer & Domain Boundary Refinement

## Decision Drivers

- Make business capability ownership explicit as the presentation layer grows.
- Keep feature internals replaceable without creating deep-import coupling.
- Ensure client-side cache namespaces have one owner and a stable public contract.
- Prevent `src/shared/` from becoming an unowned domain utility layer.

## Context

ADR-007 established feature-first organization and used a strict interpretation of feature isolation. The application now has legitimate composition flows between features, while several domain query hooks, cache keys, and composites still live in `src/shared/`. That combination obscures ownership and makes refactors depend on implementation paths.

## Decision

LunaClair uses ownership-driven feature modules with curated public contracts.

1. **Feature ownership.** Every business capability — including UI components, dialogs, query and mutation hooks, cache key factories, and feature-specific types — has exactly one owning feature. Reuse does not transfer ownership.
2. **Domain-agnostic shared layer.** `src/shared/` contains reusable, domain-agnostic UI primitives, neutral composites, and infrastructure utilities. Code that knows a Subject, Material, Term, Quiz, or other business entity belongs to a feature or the domain layer.
3. **Explicit contracts and internal privacy.** Feature internals are private by default. Cross-feature consumers import only from the owning feature's root `index.ts`; deep imports into `components/`, `hooks/`, `queries/`, `types/`, or other implementation paths are prohibited.
4. **Curated public surfaces.** Feature barrels export only stable, intentionally supported capabilities. They are not generated dumps of every internal module.
5. **Public API stability.** A feature may reorganize or replace internal implementations without affecting consumers when its public contract remains compatible.
6. **Feature-owned cache keys.** Each feature owns a query-key namespace for every client-side caching mechanism. Current namespaces are `subjectQueryKeys` (`['subject', ...]`), `libraryQueryKeys` (`['library', ...]` for materials), and `assessmentQueryKeys` (`['assessment', ...]`).

## Import Rules

- Features may import from `shared/`, `domain/`, `application/`, and infrastructure/service contracts as allowed by the layering rules.
- A feature may consume another feature only through that feature's root public contract.
- `shared/`, `domain/`, `application/`, `infrastructure/`, and `services/` must not import from features.
- Domain-specific hooks, dialogs, composites, and cache keys must not be placed in `shared/`.

## Alternatives Considered

- **Strict zero cross-feature imports:** Prevents direct coupling but pushes business capabilities into `shared/` or duplicates them at composition boundaries.
- **Unrestricted feature imports:** Allows fast reuse but exposes implementation details and increases circular-dependency risk.
- **Shared giant barrel:** Simplifies imports temporarily but creates an unstable, unowned public surface.

## Consequences

### Positive

- Ownership and cache invalidation responsibilities are visible in the repository structure.
- Consumers depend on stable contracts rather than feature implementation paths.
- Feature internals can be reorganized safely.
- `shared/` remains reusable across business domains.

### Negative / Trade-offs

- Public barrels require deliberate maintenance and review.
- Some composition flows create intentional feature dependencies and must avoid cycles.
- Moving existing shared domain code requires import updates across the application.

## Supersedes

- The strict zero-cross-feature-import interpretation in [ADR-007](ADR-007-feature-first-architecture.md). ADR-007's feature-first organization remains in force.

## Related ADRs

- [ADR-003](ADR-003-tanstack-query.md) — TanStack Query Caching & Mutations
- [ADR-007](ADR-007-feature-first-architecture.md) — Feature-First Project Module Organization
- [ADR-008](ADR-008-shared-ui-vs-components-layering.md) — Shared UI Primitives vs. Composite Components Layering
