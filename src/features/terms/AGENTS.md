# src/features/terms/ — Academic Terms Bounded Context

## Purpose

Owns academic term management and subject-term linkages: term CRUD dialogs, subject-term assignment tab, term usage aggregation, and term query/mutation hooks.

## Ownership

- `components/` — Term presentation components:
  - `SubjectTermsTab.tsx` — Workspace tab rendering academic terms assigned to a subject.
  - `SubjectTermList.tsx` — Presentational list of terms with reorder and unlink triggers.
- `modals/` — Term dialogs:
  - `CreateTermModal.tsx` — Modal for creating a new academic term.
  - `AddExistingTermModal.tsx` — Modal for linking an existing global term to a subject.
  - `UnlinkTermConfirmationModal.tsx` — Confirmation dialog for unlinking a term from a subject.
- `hooks/` — Term queries and mutations:
  - `queries/useTerms.ts` — Query hook for global terms or terms filtered by subject ID.
  - `queries/useTerm.ts` — Query hook for a single term by ID.
  - `queries/useSubjectTermUsage.ts` — Query hook for subject-term usage counts.
  - `queries/useTermUsageCounts.ts` — Query hook aggregating subject and material counts per term.
  - `mutations/useCreateTerm.ts` — Mutation hook delegating to `CreateTermUseCase`.
  - `mutations/useEditTerm.ts` — Mutation hook delegating to `UpdateTermUseCase`.
  - `mutations/useDeleteTerm.ts` — Mutation hook delegating to `DeleteTermUseCase` (clears material references, invalidates `termQueryKeys` and `materialQueryKeys`).
  - `mutations/useSubjectTermMutations.ts` — Mutation hooks for adding, removing, and reordering subject-term links.
- `queries/` — Cache key definitions:
  - `termQueryKeys.ts` — Query key factory for terms (`['subject', 'terms']`, `['subject', 'terms', subjectId]`, usage counts).

## Local Contracts

- **Directed Dependencies (ADR-014)**: Depends unidirectionally on `materials/` (for usage counts and invalidation on delete). Must not depend on `subjects/`, `quiz/`, or `app/screens/`.
- Route-level term management belongs to `src/app/screens/terms/TermManagerScreen.tsx`.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run`
- `npm run lint`
- `npm run build`

## Child DOX Index

(No child directories with AGENTS.md.)
