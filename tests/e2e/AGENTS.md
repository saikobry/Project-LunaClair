# tests/e2e/ — Playwright Acceptance Suite

## Purpose

End-to-end acceptance specs for the real app in Chromium, plus the shared helpers that seed and drive it. Run with `npm run test:e2e` (`playwright.config.ts`: `testDir ./tests/e2e`, 1 worker, sequential, real dev server).

## Ownership

- `helpers/e2e-setup.ts` — `locators`, `switchToRawMode`, `switchToVisualMode`, `switchToReadMode`, `setupApiMocks`, `resetDatabase`.
- `helpers/share-seed.ts` — the share-route mock and the real clone flow (`routeShare`, `cloneShareToLibrary`, `ShareFixture`, `WorkspaceTab`).
- `helpers/ai-prompt.ts` — `readAllowedQuestionTypes` / `requestsOnlyType` / `describeUnreadableAllowedTypes`: the single reader for "what did this generation request actually ask for", read off the app's own `- Allowed Question Types:` line in the **system** prompt. A `/api/ai/chat` route mock that must answer differently per request kind (e.g. the cloze-only card request vs. a general batch) uses this instead of parsing inline, so a prompt reword is a one-file fix. It is deliberately **tolerant**: an unrecognised prompt yields an empty list rather than throwing, which routes the mock down its default branch instead of failing a spec with a confusing content mismatch; `describeUnreadableAllowedTypes` exists so that case is still reported as what it is. Unit-tested by `src/__tests__/e2eFixtures/ai-prompt.test.ts` (Vitest, not Playwright).
- `helpers/fixtures/` — the committed `.lcpack` payloads specs serve, and the per-fixture modules that expose them.
- `*/<name>.spec.ts` — one directory per feature area (`analytics/insights.spec.ts` covers the Insights surface: the projected-card pool total, the stranded-schedule footnote after archived questions, and the post-write refresh; `quiz-management/question-bank-mobile.spec.ts` covers the Question Bank mobile disclosure panel, tag facet relocation, and duplication guard below 769px).

## Local Contracts

- **Seed only through live Worker surfaces.** `.lcpack` shares via `/api/shares` are the exclusive content distribution mechanism; the legacy catalog and its `/api/catalog`, `/api/documents`, `/api/quiz` endpoints were retired. A mock is valid only for an endpoint that exists today (`ai`, `health`, `shares`, `sync`). Never mock a retired endpoint.
- **`routeShare` mirrors the live Worker envelopes.** Its shapes are the real ones — feed `PublicShareSummary`, detail `PublishedShareResponse` (including `expiresAt: null` when unset), download `{ success, downloadCount }` on the **POST-only** route — verified against a local Worker (Sep 2026). Change a mock shape only when the Worker contract changed, not to make a spec pass.
- **Seed order matters.** `resetDatabase(page)` → `setupApiMocks(page)` → `routeShare(page, fixture)` → `cloneShareToLibrary(...)`. Playwright resolves routes last-registered-first, so `routeShare` must come **after** `setupApiMocks` or the empty-feed default wins and Explore renders nothing.
- **Never build a workspace URL by hand.** Cloning remaps every package id to a fresh local one, so `/materials/<uuid>?tab=…` is unknowable in advance. Capture it from `cloneShareToLibrary` and `page.goto` that.
- **Tabs are the app's union.** `WorkspaceTab` re-exports `MaterialWorkspaceTab` from `src/app/routing/routing.ts`: `read | quiz | flashcards | write | questions | quizzes | attachments`. There is no `manage` tab — `?tab=manage` silently falls back to `read`. The workspace's Study/Manage switch is a mode control; use `switchToReadMode` when moving from Manage to Read.
- **Fixtures are generated, never hand-edited.** `npm run generate:e2e-fixtures` writes them from canonical content via `scripts/lib/`; `src/__tests__/e2eFixtures/` fails if the committed payload drifts. Regenerate rather than editing JSON.
- **Fixture module facts come from the payload.** Share id comes from the fixture spec, displayed metadata from the payload — do not restate values a fixture already carries.
- **Scope locators to the answer/control role.** A material's document headings become reader outline buttons with those accessible names, so a bare `getByLabel('Mitochondria')` collides with the outline; use `getByRole('radio', { name: 'Mitochondria', exact: true })` to name the control you actually mean.
- **Close the AI drawer before global navigation.** Its non-modal backdrop intentionally intercepts page clicks; close the drawer before clicking header or sidebar navigation in acceptance specs.
- **`resetDatabase` writes `onboarding_done = 1`**, so it cannot be used to reach the first-run state; onboarding specs must arrange their own initial state with an init script and must not assert retired academic-term routes.
- **Support-code boundaries:** `resetDatabase` is the only content-reset helper; direct IndexedDB use in `database/reload-recovery.spec.ts` and the settings thread-count probe is intentional diagnostics, not fixture seeding. The package-sharing spec keeps custom POST/detail/download handlers only for its publish/passcode flow; its seed share uses `routeShare`. Content-dependent assertions require visible fixture text or a nonzero graph, and quiz cards expose `data-quiz-id` for scoped locators.
- **Viewport-sensitive testing sets viewport per test.** `playwright.config.ts` maintains a single project (`devices['Desktop Chrome']` at 1280×720) to avoid re-running the entire suite across extra device projects. A spec testing mobile or responsive layouts (e.g. `quiz-management/question-bank-mobile.spec.ts`) sets `page.setViewportSize({ width: 390, height: 844 })` directly inside the test, with companion desktop assertions verifying the opposite layout direction.
- **This folder holds Playwright specs only — `*.spec.ts`.** Playwright's default `testMatch` is used, unoverridden, because nothing else matches it. A Vitest test that supports this suite does **not** live here: put it in `src/__tests__/e2eFixtures/`, which Vitest's default `src/**/*.test.{ts,tsx}` include already picks up, and from which the helper is imported by relative path (`../../../tests/e2e/helpers/<name>`). That keeps `vitest.config.ts` and `playwright.config.ts` free of suite-splitting special cases, and mirrors the existing `cellStructureFixture.test.ts`. Those tests are outside all four tsconfig projects, so they are not typechecked by `tsc -b`.
- No CI runs this suite (deliberate project convention) — a green run is a manual gate.

## Work Guidance

- Add content-dependent coverage by declaring a fixture and cloning it; do not reach into IndexedDB/Dexie, hardcode catalog titles, or hand-seed storage.
- One fixture per intent, not one canonical fixture for everything: the canonical graph is for specs asserting quiz/question/export relationships; the generated `cellularRespiration` payload is the minimal markdown-only notes fixture for writer, reader, and AI generator specs (and is also the second material in unsaved-navigation coverage).
- Pre-existing fragile patterns worth fixing on sight: ancestor-walking card resolution (`locator('..').locator('..')`) and unqualified text locators that can match document content.

## Verification

- `npm run test:e2e` — full suite; must be green from a clean browser/IndexedDB state, twice in a row.
- `npx playwright test tests/e2e/<area>/<spec>.spec.ts` — single spec while iterating.
- `npm run test:run` — covers the fixture contract from both sides: validity + freshness under `src/__tests__/e2eFixtures/`, and the Worker's publish validator (`validateServerStudyPackage`) under `worker/src/__tests__/shareFixtureValidation.test.ts`. It is also how the helpers' Vitest unit tests run (`src/__tests__/e2eFixtures/ai-prompt.test.ts`).

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| (none) | — | Flat suite; areas are directories, not independent boundaries. |
