# ADR-013 — Uniform Domain Module Organization

## Status
Accepted

## Introduced
Phase 12 — Architecture & Domain Standardization

## Decision Drivers
- Disparate organization across domain directories (flat mixed dumps vs. subfolders vs. single type files).
- Need for explicit separation of Domain Entities, Repository Ports, Domain Services, and Pure Engines.
- Elimination of lingering domain barrel files in accordance with ADR-010 direct-path principles.

## Context
LunaClair's business logic layer (`src/domain/`) previously contained a mixture of structural conventions:
- Large domains like `library/` and `quiz/` placed entities, value types, repository interfaces, domain services, and helpers in a flat directory (up to 15 files).
- `sync/` placed repository interfaces in `sync/repositories/` and reconcilers in `sync/reconcilers/`.
- `flashcards/` had naming discrepancies (`Card.ts` defining `Flashcard`).
- Remnant `index.ts` barrel files persisted in `library/`, `reader/`, and `sync/`.

A standardized, uniform domain module layout was needed to ensure predictable navigability, clear role separation, and clean dependency management.

## Decision
1. **Authorized Responsibility Subdirectories**: Domain modules in `src/domain/<domain>/` must organize their code into authorized responsibility-based subfolders. Folders are created only when populated:
   - `models/`: Domain Entities, Value Objects, DTOs, and `<domain>.types.ts`
   - `repositories/`: Async repository persistence port interfaces
   - `services/`: Capability and multi-aggregate domain service contracts and implementations
   - `engines/`: Pure calculation engines, schedulers, algorithms, and serializers
   - `context/`: Context assemblers and markdown extraction helpers
   - `strategies/`: Strategy pattern implementations and resolvers
   - `reconcilers/`: Synchronization convergence and merge engines
   - `validation/`: Domain schema and draft validators
   - `policies/`: Retry and backoff policies
   - `factories/`: In-memory entity and virtual quiz generators
   - `errors/`: Typed domain error classes
   - `utils/`: Tokenizers, date helpers, and mathematical utilities
2. **Local Colocated Tests**: Unit tests for domain code are colocated in a `__tests__/` directory directly within the responsibility folder where the tested unit resides.
3. **Domain Barrels Prohibited**: Internal domain barrels (`index.ts`) are eliminated; consumers import directly from the concrete module paths.
4. **Naming Parity**: The flashcard entity file is standardized as `src/domain/flashcards/models/Flashcard.ts`.

## Alternatives Considered
- **Flat directory structure for all domains**: Rejected because large domains (`quiz`, `library`, `sync`) become cluttered when entities, repositories, and algorithms are dumped into a single directory.
- **Strictly identical subfolders across all domains (even if empty)**: Rejected because creating empty directories introduces unnecessary directory boilerplate.

## Consequences
### Positive
- Highly predictable directory structure across all 11 bounded domains.
- Clear mental model separating pure data (models) from interfaces (repositories) and operations (services/engines).
- 100% direct-path import clarity with zero barrel overhead.

### Negative / Trade-offs
- Requires updating existing relative import paths across consuming layers.

## Related ADRs
- [ADR-001](ADR-001-repository-pattern.md)
- [ADR-007](ADR-007-feature-first-architecture.md)
- [ADR-010](ADR-010-replace-barrel-based-feature-boundaries.md)
- [ADR-012](ADR-012-primary-unit-test-organization-and-discoverability.md)
