# src/domain/package/ — StudyPackage Pure Domain

## Purpose

Pure domain contracts, types, validators, remappers, and inspection engines for the Phase 11A StudyPackage specification (`.lcpack` bundle format) enabling portable, offline-first material sharing and exchange.

## Ownership

- `package.types.ts` — Canonical domain interfaces (`StudyPackage`, `StudyPackageMetadata`, `PackageMaterial`, `PackageQuestion`, `PackageQuizItem`, `PackageQuiz`, `PackageAsset`, `LocalIdGenerator`, `RemappedStudyPackage`, `PackageValidationResult`, `StudyPackageSummary`, `PackageInspection`).
- `StudyPackageImportService.ts` — Domain application port for atomic multi-store package imports using platform-neutral primitives (`dataBase64`).
- `validateStudyPackage.ts` — Pure structural, referential, prefix, schema, and per-type question-payload integrity validator for incoming untrusted package payloads. **Single strict tier, no options**: every finding is an `error` and a package carrying one is refused rather than imported with a note. Explicitly rejects packages carrying an unsupported `flashcards` property.
- `remapStudyPackage.ts` — Pure relational remapping engine generating collision-free local UUIDs, rewiring foreign key relationships, and re-targeting embedded markdown asset URIs.
- `inspectStudyPackage.ts` — Pure metadata and metrics aggregation engine for package inspection and preview screens.

## Local Contracts

- Format identifier is strictly `'lcpack'`, and supported schema version is `1`.
- Package asset identity travels in both directions. **Inbound:** `StudyPackageImportService` carries it explicitly — `ImportStudyPackageAsset.assetId` (the remapped local UUID the rewritten `lc-asset://` documentContent URIs point at) plus `materialId` (grouping only) — so an N-figure package lands as N resolvable rows instead of collapsing to one per material. **Outbound:** the materializer numbers a material's assets `pkg_asset_1..N` in a deterministic order (filename asc, then asset id as tie-breaker) and rewrites every `lc-asset://{assetId}` to that same asset's package id, so each reference stays paired with its own payload across repeated exports. References with no matching asset are left untouched.
- Material tags (`PackageMaterial.tags`, optional `string[]`) are portable package data: `validateStudyPackage` accepts absent tags and rejects non-string-array values, and `remapStudyPackage` copies them verbatim (fresh array) to the remapped material. `ImportStudyPackageUseCase` writes them onto the local material, so a clone arrives tagged — the full loop (publish → package → clone) already carries them.
- `inspectStudyPackage` exposes those tags as `StudyPackageSummary.tags`: the union across materials, cleaned like app tag tokens (trimmed, leading `#` stripped) and deduped case-insensitively in first-seen order. Package-level `metadata.tags` is deliberately **not** merged in — the format accepts it, but nothing populates it and import ignores it, so a preview built from it would advertise tags the clone never receives.
- Standardized package entity ID prefix constraints:
  - Material: `pkg_mat_*`
  - Question: `pkg_q_*`
  - Quiz: `pkg_quiz_*`
  - Asset: `pkg_asset_*`
- Zero React/UI, zero Dexie/persistence, and zero DOM dependencies.
- **`.lcpack` flashcards channel removal and explicit rejection contract:**
  - The legacy `pkg_card_*` package channel and `PackageFlashcard` interface were removed. Justification & evidence: (1) `MaterializeStudyPackageUseCase` previously emitted a hardcoded empty array, so no package ever carried a card; (2) `hints` had zero consumers anywhere and no authoring source on `Question`; (3) remote D1 `shares` table was never created (migration never applied remotely), so no `.lcpack` was ever published; (4) flashcards are pure runtime projections of questions (`questionToCards`), never authored package records.
  - **Explicit rejection contract:** `validateStudyPackage` does not reject unknown fields generally. Simply dropping card validation would allow card-bearing packages to silently pass and have cards dropped on remapping. Therefore, any presence of a `flashcards` property is explicitly refused via an own-property check (`Object.prototype.hasOwnProperty.call(raw, 'flashcards')`) with the error `'Package "flashcards" is not supported.'`, mirrored byte-for-byte in the Worker validator.
- **`validateStudyPackage(input)` is ONE strict validator, and its signature says so.** There is no `strictness` option and no `StudyPackageValidationStrictness` type: `PackageValidationResult` is `{ isValid, errors }` and every structural defect lands in `errors`. It used to take `{ strictness }` with a tolerant `read` default that recorded a malformed question payload as a non-blocking `warning`, imported the row anyway, and left the caller to describe the damage — on the promise that shares published before payload validation existed had to stay cloneable. **That promise was checked against the remote D1 `shares` table and found to defend an empty population:** the table was created by a migration never applied remotely, so no `.lcpack` has ever been published. The tolerance was therefore not merely dead but load-bearing in the wrong direction — it was the one ingress with no way to say no, and the reason a malformed payload could reach a learner's deck at all. **An unused `read` mode was explicitly rejected rather than kept as a compromise:** it retains implementation and test burden without preserving a production path, and a switch with one reachable value misrepresents the contract.
- **A malformed package is REFUSED, and the refusal names the offending question.** Every `validateQuestionPayload` finding is pushed as `Question "<pkg_q_id>": <defect>`, so a caller can tell the user which question is wrong and which field is at fault. `ImportStudyPackageUseCase` throws before the transaction opens — a refused import is neither a partial import nor a rollback, because nothing was written. `useImportStudyPackage`, `useCloneShare`, and `SharedPackageScreen` surface that throw through their existing error channels. **The notice machinery this replaced is deleted**: no `PackageValidationWarning`, no `classifyPackageQuestionDefect`, no `PackageQuestionDefect`, no `importWarningsNotice` copy. What the user sees now is a refusal naming the question and the field, which is strictly more actionable than a notice about a study shape nobody can act on.
- Pure validation (`validateStudyPackage`) checks:
  - Non-null object schema structure and required metadata.
  - Per-type question payload structure for all five types (delegated to `validateQuestionPayload`). Every finding is an error.
  - Package-wide ID uniqueness across all entity collections.
  - Absence of unsupported `flashcards` property.
  - Foreign key referential integrity (questions -> materials, quizzes -> materials, quiz items -> questions, assets -> materials).
  - Markdown asset references (`lc-asset://pkg_asset_*`) point to declared package assets.
- Pure remapping (`remapStudyPackage`) guarantees:
  - Generation of fresh local UUIDs (using `crypto.randomUUID()` or injected `LocalIdGenerator`).
  - Rewiring of all foreign keys in questions, quizzes, quiz items, and assets.
  - Transformation of embedded markdown `lc-asset://...` URIs to newly generated asset UUIDs.
  - Deterministic and collision-free isolation across sequential imports.
- Pure inspection (`inspectStudyPackage`) calculates summary statistics without mutation. Summary metrics include material, question, quiz, and asset counts (no separate flashcard metric).

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npx vitest run src/domain/package`
- `npm run build`
- `npm run lint`

## Child DOX Index

- None.
