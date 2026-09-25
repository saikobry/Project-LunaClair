# scripts/ — Build & Content Tooling

## Purpose

Standalone Node/PowerShell tooling that runs outside the app bundle: canonical-content publishing, repository hygiene, and shared build-time libraries.

## Ownership

- `seed-shares.mjs` — publisher seeder CLI: builds `.lcpack` StudyPackages from `content/**` and publishes them as public shares via `POST /api/shares`.
- `generate-e2e-fixtures.mjs` — E2E fixture CLI: writes the committed share payloads the Playwright suite serves, from the same canonical content.
- `lib/` — importable, side-effect-free libraries shared by the CLIs and tests.
  - `lib/studyPackageBuilder.mjs` — the `.lcpack` transform itself.
  - `lib/e2eShareFixtures.mjs` — the declared E2E fixture specs and the fixed fixture `createdAt`.
- `clean-whitespace.ps1` — trailing-whitespace cleanup (`npm run clean:whitespace`).
- Canonical content itself lives in `content/`, not here.

## Local Contracts

- **CLI files own filesystem, network, and argument handling. `lib/` contains importable functions with no filesystem, network, process, or import-time side effects.**
- `lib/studyPackageBuilder.mjs` is the single owner of the `.lcpack` transform: `pkg_*` identifier generation, `lc-asset://` rewriting, tag normalization, `selfValidatePackage`, and the `MAX_SHARE_PAYLOAD_BYTES` (5 MiB) size guard. Everything variable (file bytes, markdown, `createdAt`, `author`) is passed in.
- No module under `lib/` may call `process.exit`, parse `process.argv`, read the filesystem, or run work at import time — it must be safe to `import` from any context, including tests.
- Tests must not import the CLI (`seed-shares.mjs`) to reach its logic; import `lib/studyPackageBuilder.mjs` instead.
- `npm run seed:shares:local` / `seed:shares:remote` are **dry-run validators only**. Publishing requires `node scripts/seed-shares.mjs --local|--remote` (idempotent by title; `--force` deletes and republishes).
- Package shape must satisfy both the Worker validator (`worker/src/routes/shares.ts`) and the stricter client validator (`src/domain/package/engines/validateStudyPackage.ts`).
- Material tags come from each catalog entry's `tags` array only — never derived from question tags; untagged materials warn instead of failing silently.
- `resolveMaterialDir(entry)` is the single owner of "which `content/materials/<dir>` a catalog entry points at"; disk readers use it instead of re-deriving `documentId || id`.
- E2E share fixtures are **generated, never hand-edited**: `npm run generate:e2e-fixtures` writes `tests/e2e/helpers/fixtures/*.lcpack.json`, and the freshness contract in `src/__tests__/e2eFixtures/` deep-compares the committed payload against a fresh build, so a hand-edit or canonical-content edit fails loudly.
- Fixture payloads are deterministic — all variable inputs (`createdAt`, asset bytes, markdown) are pinned or read by the caller, and `metadata.createdAt` must equal `E2E_FIXTURE_CREATED_AT`.

## Work Guidance

- Keep the builder pure and deterministic: new variable inputs become parameters, never module-level reads or clocks.
- Add a new build step as a `lib/` function plus a thin CLI caller; do not grow the transform inside `seed-shares.mjs`.
- Keep `.ps1` sources ASCII-only (PowerShell 5.1 reads them as ANSI without a BOM).

## Verification

- `npm run seed:shares:local` — dry-run build; must report every canonical material `PASS` against the size ceiling.
- `npm run generate:e2e-fixtures` — rewrites the committed E2E fixtures; re-running without content changes must produce byte-identical output.
- `npm run test:run` — includes the fixture validity + freshness contract under `src/__tests__/e2eFixtures/`.
- `npm run lint` — oxlint must stay 0 warnings / 0 errors.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| (none) | — | `lib/` is covered by this doc and does not warrant its own boundary. |
