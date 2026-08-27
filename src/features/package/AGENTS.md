# src/features/package/ — Study Package Import, Export, and Preview

## Purpose

Feature-level presentation, reactive hooks, and interactive modal dialogs for portable study bundle exchange (`.lcpack` / JSON bundles), supporting pre-import inspection, destination assignment, and offline-first export/import.

## Ownership

- `components/StudyPackagePreviewModal.tsx` — Accessible StyleX-styled dialog for inspecting package metadata, summary metrics (materials, questions, quizzes, flashcards, assets, total points, question type badges derived purely via `inspectStudyPackage`), subject/term destination picker, and import confirmation.
- `hooks/useImportStudyPackage.ts` — Hook coordinating file drop/selection, parsing, pure schema & relational validation, pre-import staging, query cache invalidation, and atomic Dexie commit via `context.useCases.package.importStudyPackage`.
- `hooks/useExportStudyPackage.ts` — Hook coordinating study package extraction and materialization via `context.useCases.package.materializeStudyPackage`, `.lcpack` serialization, and browser file download.

## Local Contracts

- Zero direct imports of `src/infrastructure/**`. All package mutations and materialization route through `context.useCases.package.*`.
- Direct-path feature contracts only (ADR-010): consumed by `ImporterScreen` via `src/features/package/hooks/useImportStudyPackage` and `src/features/package/components/StudyPackagePreviewModal`.
- Pre-validation invariant: `useImportStudyPackage` validates incoming file payloads before staging or calling persistence use cases; invalid files never touch local Dexie storage.
- Destination context isolation: destination subject and term selections in `StudyPackagePreviewModal` are strictly external parameters passed to `onConfirmImport({ subjectId, termId })`, never mutating the in-memory `StudyPackage` object.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npx vitest run src/features/package` — Unit tests for preview modal and import/export hooks.
- `npm run build` — TypeScript (`tsc -b`) and Vite production bundle check.
- `npm run lint` — Oxlint static boundary analysis.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
