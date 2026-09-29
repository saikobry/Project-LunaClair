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
- Package asset identity travels in both directions. **Inbound:** `StudyPackageImportService` carries it explicitly — `ImportStudyPackageAsset.assetId` (the remapped local UUID the rewritten `lc-asset://` documentContent URIs point at) plus `materialId` (grouping only) — so an N-figure package lands as N resolvable rows instead of collapsing to one per material. **Outbound:** the materializer numbers a material's assets `pkg_asset_1..N` in a deterministic order (filename asc, then asset id as tie-breaker) and rewrites every `lc-asset://{assetId}` to that same asset's package id, so each reference stays paired with its own payload across repeated exports. References with no matching asset are left untouched.
- Material tags (`PackageMaterial.tags`, optional `string[]`) are portable package data: `validateStudyPackage` accepts absent tags and rejects non-string-array values, and `remapStudyPackage` copies them verbatim (fresh array) to the remapped material. `ImportStudyPackageUseCase` writes them onto the local material, so a clone arrives tagged — the full loop (publish → package → clone) already carries them.
- `inspectStudyPackage` exposes those tags as `StudyPackageSummary.tags`: the union across materials, cleaned like app tag tokens (trimmed, leading `#` stripped) and deduped case-insensitively in first-seen order. Package-level `metadata.tags` is deliberately **not** merged in — the format accepts it, but nothing populates it and import ignores it, so a preview built from it would advertise tags the clone never receives.
- **`PackageQuestion.sourceSection` (optional `string`) is portable question provenance: the section label captured when the question was generated.** It exists because the generator computes that label and previously threw it away, leaving a generated question unable to say where it came from. It is the **section label captured at generation time, not a durable citation** — the document is editable afterwards, so the label is never resolved against the current document and a label that has gone stale is the honest record.
  - **Compatibility policy — additive and optional, one-directional, and lossy in the other direction. Absence is valid and stays valid forever.** A package published before the field existed validates unchanged, so no version bump is required and no existing share can be stranded. **Publication is deliberately NOT strict**: the materializer emits the key only when the question has a label and never synthesizes one, because a hand-authored question legitimately has no provenance.
  - **An older deployed client cloning a new package SILENTLY DROPS `sourceSection`.** The field is additive, so old *data* is safe; the exposure runs the other way. A client released before the field existed validates the extra key without complaint but has no field on its remap target, so it simply does not copy the label onto the imported `Question` — no error, no warning, and the question arrives with valid content and **no provenance**. **Provenance is therefore best-effort across client versions, not guaranteed**: a share published by a current build and cloned by an older build yields questions with no `sourceSection` at all, and nothing detects the loss. This is accepted deliberately, not overlooked: the field is **non-critical metadata** (a generation-time section label, never resolved against the document), a lost label degrades to "unknown provenance" rather than to wrong or missing content, and it costs no migration, no version gate, and no re-publish. The cost of closing the gap — a format version bump, a client capability handshake, or a resync of every published share — would be far out of proportion to the metadata. **Do not treat "the field round-trips" as a compatibility claim in a test or a doc**: pin the round trip for the current client only, and state the drop explicitly wherever provenance is described as preserved.
  - **Only a present-but-wrong value is rejected** — a non-string fails both `validateStudyPackage` (client) and `validateServerStudyPackage` (Worker). The two rules are identical by necessity: a package the app can clone must be a package the Worker accepts, or publish and import disagree.
  - `remapStudyPackage` copies the label onto the remapped `Question`; absence stays absence, per question, with no leaking between rows. **Within one client version this is a lossless copy**; the loss described above is a client-version skew, not a remapper defect.
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
