# src/features/package/ — Study Package Import, Export, and Preview

## Purpose

Feature-level presentation, reactive hooks, and interactive modal dialogs for portable study bundle exchange (`.lcpack` / JSON bundles), supporting pre-import inspection, destination assignment, and offline-first export/import.

## Ownership

- `components/StudyPackagePreviewModal.tsx` — Shared `<Dialog>`-based modal for inspecting package metadata, the package's **material tags** as shared `Chip` pills (`summary.tags` — what the imported material will carry), summary metrics via `PackageStatsGrid` and `QuestionTypeBreakdown` (`chrome="none"`, derived purely via `inspectStudyPackage`) and import confirmation.
- `components/PackageStatsGrid.tsx` — Package metric stat cards (`{summary}` pre-fetched only, rendering 5 metrics: Materials, Questions, Quizzes, Figures, and Size; the legacy Flashcards stat was removed as flashcards are projected locally from questions) unifying the preview modal grid and the share landing surface; owns `packageStatsGrid.stylex.ts`.
- `components/QuestionTypeBreakdown.tsx` — Question-type badge list (`{entries}` pre-derived only, `chrome: 'card' | 'none'` — the host decides who owns the card frame) unifying the preview modal badges (`QuestionTypesCard` renamed: it renders badges, not a quiz card); owns `questionTypeBreakdown.stylex.ts`.
- `utils/packageFormat.ts` — Canonical `formatQuestionType` / `formatPackageDate` (single ownership; verbatim copies removed from both callers). `formatQuestionType` is a one-line safe accessor over the domain's `QUESTION_TYPE_LABELS` (an unknown type falls back to a de-underscored string), so a new question type cannot introduce a second spelling.
- `hooks/useExportStudyPackage.ts` — Hook coordinating study package extraction and materialization via `context.useCases.package.materializeStudyPackage`, the **strict client publish gate** (see Local Contracts), `.lcpack` serialization, and browser file download.
- `components/ShareStudyPackageModal.tsx` — Shared `<Dialog>`-based modal for publishing portable study packages to the cloud, configuring access types (public, unlisted, passcode), optional expiration, and copying generated full/short share links.
- `SharedPackageScreen.tsx` — Feature-root screen for shared study packages (`/share/:shareId`, `/s/:code`), managing loading, passcode challenge unlock, error states, package inspection metrics, atomic "Clone to Library" with subsequent download telemetry tracking, and ".lcpack" file download. A clone refused for malformed content surfaces through the existing error toast and leaves the surface exactly as cloneable as it was — no success banner, no local material, and the Clone action still on offer.
- `hooks/useImportStudyPackage.ts` — Hook coordinating file drop/selection, parsing, pure schema & relational validation, pre-import staging, query cache invalidation, and atomic Dexie commit via `context.useCases.package.importStudyPackage`. Validation runs on the parsed file BEFORE staging, so a malformed package never reaches the preview or the import use case: the finding is set as `errorMessage` and toasted with `intent: 'error'`.
- `hooks/useStudyPackageSize.ts` — Hook measuring the serialized `.lcpack` byte budget for a material (`SHARE_PACKAGE_SIZE_LIMIT_BYTES`, kept beside the worker's `MAX_SHARE_PAYLOAD_BYTES` by convention) without downloading: materialize → serialize → read blob size → discard. Offline-safe; intentionally never invalidated on edits (re-measure on mount is enough for a budget indicator).
- `hooks/usePublishStudyPackage.ts` — Hook coordinating study package publication to cloud with access type and expiration options via `context.useCases.sharing.publishStudyPackage`.

## Local Contracts

- Zero direct imports of `src/infrastructure/**`. All package mutations, materialization, and sharing use cases route through `context.useCases.package.*` and `context.useCases.sharing.*`.
- Direct-path feature contracts only (ADR-010): consumed by `ImporterScreen` via `src/features/package/hooks/useImportStudyPackage` and `src/features/package/components/StudyPackagePreviewModal`; consumed by `MaterialWorkspace`, `FlashcardTab`, and `QuizManagementTab` via `src/features/package/hooks/useExportStudyPackage` and `src/features/package/components/ShareStudyPackageModal`; consumed by `ShellRoutes` via `src/features/package/SharedPackageScreen`; consumed by `screens/shared-package/*` via `src/features/package/components/PackageStatsGrid`, `src/features/package/components/QuestionTypeBreakdown`, and `src/features/package/utils/packageFormat` (share landing surface delegates its stats/type-breakdown to the package feature; never `shared/ui`, which stays domain-agnostic).
- Pre-validation invariant: `useImportStudyPackage` and `FetchPublishedShareUseCase` validate incoming package payloads before staging or calling persistence use cases; invalid files never touch local Dexie storage.
- **Outbound pre-publication invariant: the client validator gates both ways a package leaves the device.** `useExportStudyPackage` runs `validateStudyPackage(pkg)` on the materialized package and refuses to write a file, and `PublishStudyPackageUseCase` runs the same call before handing anything to `ShareTransport`. The Worker stays the server-side authority and refuses the same package, so this never replaces it — it exists because `MaterializeStudyPackageUseCase` copies each question's payload **verbatim**, so a question whose stored payload is malformed is re-materialized exactly as malformed. Failing here is the point: the alternative is an exported `.lcpack` nobody can clone, or a publish that only fails after a round trip. The refusal is reported through each surface's existing error channel and names the offending question. `MaterializeStudyPackageUseCase` itself is deliberately **not** the gate — `useStudyPackageSize` shares it purely to measure bytes, and must not start failing on a legacy material.
- Telemetry timing invariant: In `SharedPackageScreen`, `trackShareDownload` is called strictly AFTER the atomic Dexie transaction succeeds for library clones, or after package blob serialization triggers for file downloads.
- **A malformed package is a REFUSAL, and the refusal is an error state.** There is no notice tier: `validateStudyPackage` is strict, so a package carrying a structurally malformed question payload is refused before anything is written, and every surface reports it through its existing error channel — the `error` toast from `useImportStudyPackage` and `useCloneShare`, the screen-level toast on `SharedPackageScreen`. The message names the offending question and field (`Question "pkg_q_1": … requires a non-empty "correctAnswer" string.`), which is strictly more actionable than the reduced-form notice this replaced. **No channel may present a refused package as a partial success.**

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npx vitest run src/features/package` — Unit tests for preview modal and import/export hooks.
- `npm run build` — TypeScript (`tsc -b`) and Vite production bundle check.
- `npm run lint` — Oxlint static boundary analysis.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
