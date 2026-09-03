# src/features/subjects/ — Academic Subjects Bounded Context

## Purpose

Owns academic subject hierarchy management: subject cards, modal dialogs for creating and editing subjects, drag-and-drop reordering, and subject query/mutation hooks.

## Ownership

- `components/` — Subject presentation components:
  - `MaterialsTab.tsx` — Workspace tab rendering materials filtered by subject.
- `modals/` — Subject creation and modification dialogs:
  - `CreateSubjectModal.tsx` — Modal for creating a new academic subject.
  - `EditSubjectModal.tsx` — Modal for editing subject title and description.
- `hooks/` — Subject state & mutation hooks:
  - `queries/useSubject.ts` — Query hook for a single subject by ID.
  - `queries/useSubjects.ts` — Query hook for all subjects in display order.
  - `mutations/useCreateSubject.ts` — Mutation hook delegating to `CreateSubjectUseCase`.
  - `mutations/useEditSubject.ts` — Mutation hook delegating to `UpdateSubjectUseCase`.
  - `mutations/useDeleteSubject.ts` — Mutation hook delegating to `DeleteSubjectUseCase` (unlinks materials and invalidates `subjectQueryKeys` & `materialQueryKeys`).
  - `mutations/useReorderSubjects.ts` — Mutation hook delegating to `ReorderSubjectsUseCase`.
- `queries/` — Cache key definitions:
  - `subjectQueryKeys.ts` — Query key factory for subjects (`['subject', 'subjects']`, `['subject', 'subject', id]`).
- `styles/` — StyleX styles:
  - `subjectModal.stylex.ts` — Shared StyleX styles for subject modals.

## Local Contracts

- **Directed Dependencies (ADR-014)**: Depends unidirectionally on `materials/` (for invalidation upon subject deletion and materials tab rendering). Must not depend on `quiz/`, `terms/`, or `app/screens/`.
- Route-level workspace orchestration belongs to `src/app/screens/subject-workspace/SubjectWorkspaceScreen.tsx`.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run`
- `npm run lint`
- `npm run build`

## Child DOX Index

(No child directories with AGENTS.md.)
