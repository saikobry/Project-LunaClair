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
- **`npm run seed:shares:local` / `seed:shares:production` / `seed:shares:staging` are ALL dry-run validators — every `seed:shares:*` script carries `--dry-run`.** No npm script publishes; the safe default is not something a script name has to opt out of. Publishing requires the CLI directly: `node scripts/seed-shares.mjs --local|--production|--staging` (idempotent by title; `--force` deletes and republishes). There is deliberately no `seed:shares:staging:dry-run` twin — a `:dry-run` suffix implies a non-dry sibling, and the sibling is the thing being removed. A dry run prints the exact publish command for its resolved target, so the run that validates is also the run that tells you how to publish.
  - **A dry run ends by printing the command that would publish for real**, so promoting a run is copy-paste rather than flag recall — necessary because the npm scripts hide their own `--dry-run`, leaving the publish step reachable only from documentation. The echo is keyed off the **resolved URL**, like the banner, so a `--url` / `SEED_SHARES_URL` run echoes `--url <baseUrl>` instead of a wrong target flag; `--force` is carried across when it was passed. When any package failed validation the hint is **replaced** by a pointer to fix it first — it must never suggest a command that can only fail.
  - **Targets are named `--local` / `--production` / `--staging`, resolved through `TARGET_URLS`.** The middle flag used to be `--remote`, which was a trap: with `--staging` in the set, "remote" described *both* deployed environments while actually meaning production, so the name read far more innocent than the effect (it writes to live D1). `--production` names the environment instead of its reachability; the constant is `PRODUCTION_URL`. The mapping is one table (`TARGET_URLS`), so a new environment is a constant plus a row, and the console banner derives its label by looking the **resolved** URL back up in that table — it labels the URL, not the raw flag, because `--url` / `SEED_SHARES_URL` bypass `target` entirely and labelling the flag previously reported a staging publish as "local mode".
- **Package shape must satisfy both the Worker publish validator (`worker/src/routes/shares.ts`) and the client validator (`src/domain/package/engines/validateStudyPackage.ts`) — the publish tiers are equivalent (same verdicts and messages, including per-type question payload structure); the client has no more permissive tier — there is exactly one validation contract on both sides, so the seeder cannot produce a package the endpoint would refuse.**
- **The dry run applies the strict client per-type question payload rules, by IMPORTING them rather than restating them.** `selfValidatePackage` calls `validateQuestionPayload` from `src/domain/quiz/validation/questionPayloadValidation.ts` — the same module the client's `validateStudyPackage` and the Worker's mirrored copy are written against — so the seeder cannot report a `PASS` the endpoint would refuse. It was previously payload-shape-generic (it checked only that a question carried *an* payload object), which let a cloze whose `___` count disagreed with its `blanks.length` pass a dry run and be rejected later, at the endpoint, after a round trip. **There is no third copy of these rules anywhere in `scripts/`**: a rule added or reworded in the domain changes the dry run's verdict with it. Two guards mirror `validateStudyPackage`, so the builder's own errors stay the single report and the validator's type switch is never reached with an unknown type: the call runs only for a known question type carrying a non-array object payload. The 5 MiB size guard, the `pkg_*` ID rules, and the untagged-material warning are unchanged.
- `lib/studyPackageBuilder.mjs` imports that domain module directly, so `npm run seed:shares:*` and `npm run generate:e2e-fixtures` need Node's native TypeScript type stripping (unflagged from Node 22.18 / 23.6). The module is pure and fully erasable (`erasableSyntaxOnly` is on in `tsconfig.app.json`), so nothing is transpiled.
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
- `npm run test:run` — includes the fixture validity + freshness contract under `src/__tests__/e2eFixtures/`, which also holds `publisherPackageValidation.test.ts`: the dry run must reject what the strict client publish tier rejects (a cloze whose `___` count disagrees with its answers, a blank cloze answer, a payload naming a different type) and still accept a well-formed package. It asserts the **builder's verdict equals the client publish tier's verdict**, not just that a shape is rejected, so a looser check in the builder cannot come back quietly. That file reaches outside `src/`, which is why the folder is excluded from every tsconfig project.
- `npm run lint` — oxlint must stay 0 warnings / 0 errors.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| (none) | — | `lib/` is covered by this doc and does not warrant its own boundary. |
