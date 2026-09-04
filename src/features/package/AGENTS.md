# src/features/package/ — Study Package Import, Export, and Preview

## Purpose

Feature-level presentation, reactive hooks, and interactive modal dialogs for portable study bundle exchange (`.lcpack` / JSON bundles), supporting pre-import inspection, destination assignment, and offline-first export/import.

## Ownership

- `components/StudyPackagePreviewModal.tsx` — Shared `<Dialog>`-based modal for inspecting package metadata, summary metrics (materials, questions, quizzes, flashcards, assets, total points, question type badges derived purely via `inspectStudyPackage`), subject/term destination picker, and import confirmation.
- `components/ShareStudyPackageModal.tsx` — Shared `<Dialog>`-based modal for publishing portable study packages to the cloud, configuring access types (public, unlisted, passcode), optional expiration, and copying generated full/short share links.
- `SharedPackageScreen.tsx` — Feature-root screen for shared study packages (`/share/:shareId`, `/s/:code`), managing loading, passcode challenge unlock, error states, package inspection metrics, destination subject/term picker, atomic "Clone to Library" with subsequent download telemetry tracking, and ".lcpack" file download.
- `hooks/useImportStudyPackage.ts` — Hook coordinating file drop/selection, parsing, pure schema & relational validation, pre-import staging, query cache invalidation, and atomic Dexie commit via `context.useCases.package.importStudyPackage`.
- `hooks/useExportStudyPackage.ts` — Hook coordinating study package extraction and materialization via `context.useCases.package.materializeStudyPackage`, `.lcpack` serialization, and browser file download.
- `hooks/usePublishStudyPackage.ts` — Hook coordinating study package publication to cloud with access type and expiration options via `context.useCases.sharing.publishStudyPackage`.

## Local Contracts

- Zero direct imports of `src/infrastructure/**`. All package mutations, materialization, and sharing use cases route through `context.useCases.package.*` and `context.useCases.sharing.*`.
- Direct-path feature contracts only (ADR-010): consumed by `ImporterScreen` via `src/features/package/hooks/useImportStudyPackage` and `src/features/package/components/StudyPackagePreviewModal`; consumed by `MaterialWorkspace`, `FlashcardScreen`, and `QuizManagementScreen` via `src/features/package/hooks/useExportStudyPackage` and `src/features/package/components/ShareStudyPackageModal`; consumed by `ShellRoutes` via `src/features/package/SharedPackageScreen`.
- Pre-validation invariant: `useImportStudyPackage` and `FetchPublishedShareUseCase` validate incoming package payloads before staging or calling persistence use cases; invalid files never touch local Dexie storage.
- Destination context isolation: destination subject and term selections in `StudyPackagePreviewModal` and `SharedPackageScreen` are strictly external parameters passed to import workflows, never mutating the in-memory `StudyPackage` object.
- Telemetry timing invariant: In `SharedPackageScreen`, `trackShareDownload` is called strictly AFTER the atomic Dexie transaction succeeds for library clones, or after package blob serialization triggers for file downloads.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npx vitest run src/features/package` — Unit tests for preview modal and import/export hooks.
- `npm run build` — TypeScript (`tsc -b`) and Vite production bundle check.
- `npm run lint` — Oxlint static boundary analysis.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
