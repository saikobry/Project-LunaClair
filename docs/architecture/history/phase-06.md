# Phase 6 — Application Layer & Domain Boundary Refinement

## 1. Executive Summary

Status: complete for the approved implementation scope (100%). Phase 6 introduces a framework-agnostic application layer, a composition root, direct use-case invocation from mutation adapters, and atomic quiz-session submission. The only deliberate compatibility concession is temporary flattened repository access on the React context for query hooks during migration.

## 2. Files Changed Breakdown

- Added `src/application/` use cases and `src/app/bootstrap/` composition functions.
- Modified application context/provider, quiz, quiz-management, library, subject, reader, and shared mutation hooks.
- Modified `DexieLibraryRepository` to remove business validation and corrected quiz item IDs in `DexieQuizRepository`.
- Deleted `src/features/quiz-management/services/QuizManagementService.ts`.
- Updated DOX contracts, roadmap, and the living architecture guide.

## 3. Component & Layer Architecture

```text
React screens/hooks → Application use cases → Domain repository ports/services
        │                         │                    │
   Query cache             pure AssessmentService   Dexie/local adapters
                                                        │
                                                   IndexedDB / assets
```

## 4. Core Domain & Data Resolution

Use cases consume `QuestionRepository`, `QuizRepository`, `QuizSessionRepository`, library ports, subject-term ports, `TermService`, and `AnnotationRepository`. Assessment remains pure and grades immutable question snapshots. Material association and complete subject-term-list validation now execute before persistence.

## 5. Asset & Storage Organization

Static reader content remains under `public/materials/` and is resolved by `LocalDocumentRepository`. Application code remains under `src/`; Dexie data remains under `src/infrastructure/database/`. This keeps content portable and storage details out of use cases.

## 6. Migration Strategy

The React context still exposes repository members alongside `{ useCases, repositories }` so existing query hooks remain operational. New and migrated mutation hooks use cases directly. The flattened compatibility surface can be removed after query hooks are migrated.

## 7. Error Handling & Guarding Strategy

Use cases throw domain/workflow errors for missing sessions, invalid lifecycle state, missing materials, invalid subject-term associations, and incomplete reorder lists. Existing context guards and reader `DocumentNotFoundError` handling remain unchanged.

## 8. End-to-End Data Flow

```text
User action → TanStack mutation hook → use case → repository port → Dexie
Quiz submit → session snapshot lookup → AssessmentService.gradeSubmission
           → completeSession(answer/result) → cache invalidation → result UI
```

## 9. Deprecated / Removed Architecture

`QuizManagementService` was removed because it duplicated application orchestration inside a feature. Its responsibilities are now independently injectable question and quiz use cases. Dexie library validation was removed because repositories now perform persistence only.

## 10. Verification & Quality Assurance

- `npm run build`: passed (`tsc -b` and Vite build).
- `npm run lint`: passed with four pre-existing warnings outside the new application boundary.
- `npx react-doctor@latest --verbose --scope changed`: passed with score 100/100 and no issues.
- Preview/runtime verification was not run; no preview command is configured in the project contract.

## 11. Full System Architecture Overview

UI primitives and feature screens compose query/mutation hooks. Hooks use TanStack Query for cache behavior and delegate business writes to `src/application/`. Use cases depend only on domain contracts. Infrastructure supplies Dexie and local-content implementations through `createRepositories()`, while `createUseCases()` and `createApplication()` assemble the graph.

## 12. Final Assessment & Next Phase Readiness

The approved Phase 6 boundary is implemented and build-verified. Remaining technical debt is the temporary flattened repository compatibility surface and the pre-existing lint/build warnings. The system is ready for the next feature phase after query hooks complete their repository-access migration.
