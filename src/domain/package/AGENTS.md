# src/domain/package/ — StudyPackage Pure Domain

## Purpose

Pure domain contracts, types, validators, remappers, and inspection engines for the Phase 11A StudyPackage specification (`.lcpack` bundle format) enabling portable, offline-first material sharing and exchange.

## Ownership

- `package.types.ts` — Canonical domain interfaces (`StudyPackage`, `StudyPackageMetadata`, `PackageMaterial`, `PackageQuestion`, `PackageQuizItem`, `PackageQuiz`, `PackageFlashcard`, `PackageAsset`, `LocalIdGenerator`, `RemappedStudyPackage`, `PackageValidationResult`, `StudyPackageSummary`, `PackageInspection`).
- `StudyPackageImportService.ts` — Domain application port for atomic multi-store package imports using platform-neutral primitives (`dataBase64`).
- `validateStudyPackage.ts` — Pure structural, referential, prefix, and schema integrity validator for incoming untrusted package payloads.
- `remapStudyPackage.ts` — Pure relational remapping engine generating collision-free local UUIDs, rewiring foreign key relationships, and re-targeting embedded markdown asset URIs.
- `inspectStudyPackage.ts` — Pure metadata and metrics aggregation engine for package inspection and preview screens.
- `index.ts` — Module entrypoint re-exporting all package types, ports, and pure domain utilities.

## Local Contracts

- Format identifier is strictly `'lcpack'`, and supported schema version is `1`.
- Standardized package entity ID prefix constraints:
  - Material: `pkg_mat_*`
  - Question: `pkg_q_*`
  - Quiz: `pkg_quiz_*`
  - Flashcard: `pkg_card_*`
  - Asset: `pkg_asset_*`
- Zero React/UI, zero Dexie/persistence, and zero DOM dependencies.
- Pure validation (`validateStudyPackage`) checks:
  - Non-null object schema structure and required metadata.
  - Package-wide ID uniqueness across all entity collections.
  - Foreign key referential integrity (questions -> materials, quizzes -> materials, quiz items -> questions, flashcards -> materials, assets -> materials).
  - Markdown asset references (`lc-asset://pkg_asset_*`) point to declared package assets.
- Pure remapping (`remapStudyPackage`) guarantees:
  - Generation of fresh local UUIDs (using `crypto.randomUUID()` or injected `LocalIdGenerator`).
  - Rewiring of all foreign keys in questions, quizzes, quiz items, flashcards, and assets.
  - Transformation of embedded markdown `lc-asset://...` URIs to newly generated asset UUIDs.
  - Deterministic and collision-free isolation across sequential imports.
- Pure inspection (`inspectStudyPackage`) calculates summary statistics without mutation.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npx vitest run src/domain/package`
- `npm run build`
- `npm run lint`

## Child DOX Index

- None.
