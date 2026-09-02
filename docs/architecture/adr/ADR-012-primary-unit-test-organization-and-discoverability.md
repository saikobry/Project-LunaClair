# ADR-012 — Primary Unit Test Organization and 1:1 Discoverability Standard

## Status
Accepted

## Introduced
Phase 12 — Architecture & Domain Standardization

## Decision Drivers
- Need for predictable, deterministic, and easily discoverable test locations across both application and domain layers.
- Avoidance of monolithic consolidated test files becoming unmaintainable catch-alls.
- Clear separation between orchestration/use case contract testing and pure domain business invariant testing.

## Context
As LunaClair grew, unit and integration tests followed disparate organizational patterns: some features used single monolithic test files (e.g., `analyticsUseCases.test.ts`, `QuizLifecycleUseCases.test.ts`), while others used 1:1 colocated files. Furthermore, pure domain algorithms were frequently tested only indirectly through UI or application use cases.

A standardized testing architecture was required to guarantee that any developer or automated agent changing an application operation or domain algorithm can instantly locate its corresponding test contract.

## Decision
1. **1:1 Primary Test Invariant**: Every application use case and every testable domain behavior unit possesses a dedicated primary unit-test file named after the unit:
   $$\text{<UnitName>.ts} \quad \longleftrightarrow \quad \text{\_\_tests\_\_/<UnitName>.test.ts}$$
2. **Local Responsibility Colocation**: Test files are colocated inside a `__tests__/` directory directly within the responsibility folder where the tested unit resides (e.g., `src/domain/quiz/services/__tests__/AssessmentService.test.ts`, `src/domain/flashcards/engines/__tests__/scheduler.test.ts`, `src/application/use-cases/quiz/__tests__/SubmitQuizSessionUseCase.test.ts`).
3. **Pure Domain Testing**: Domain unit tests are pure, in-memory, deterministic, and test observable input/output behavior without mocking domain logic.
4. **Supplementary Suites**: Complex integration, concurrency, or roundtrip tests (e.g., `packageRoundtrip.test.ts`) are authorized as supplementary test files alongside primary unit tests.

## Alternatives Considered
- **Centralized `tests/` root directory**: Rejected because it separates test suites from implementation context and increases maintenance overhead during refactoring.
- **Single consolidated test file per domain**: Rejected because monolithic test files obscure specific failures and violate 1:1 discoverability.

## Consequences
### Positive
- Instant 1:1 discoverability between code and test contracts.
- Isolated, fast-running test execution per unit.
- Clear distinction between application orchestration tests and pure domain invariant tests.

### Negative / Trade-offs
- Increases total test file count across the repository.

## Related ADRs
- [ADR-010](ADR-010-replace-barrel-based-feature-boundaries.md)
- [ADR-011](ADR-011-public-application-context-and-cqrs-read-model.md)
- [ADR-013](ADR-013-uniform-domain-module-organization.md)
