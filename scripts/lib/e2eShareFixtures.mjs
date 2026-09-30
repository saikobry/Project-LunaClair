/**
 * Declared E2E share fixtures — the single source of truth for the `.lcpack`
 * packages the Playwright suite serves from its mocked `/api/shares` routes.
 *
 * Pure, like every other `lib/` module: no filesystem, network, or import-time
 * side effects. `scripts/generate-e2e-fixtures.mjs` reads canonical content and
 * writes the committed payloads; the Vitest freshness check in
 * `src/__tests__/e2eFixtures/` regenerates through this same function and
 * deep-compares, so a builder or canonical-content change fails loudly instead
 * of silently shipping a stale fixture.
 *
 * The E2E suite declares one fixture per published graph it exercises. The
 * cellular-respiration payload is deliberately the minimal markdown-only notes
 * fixture for writer, reader, and AI generator coverage; the cell-structure
 * payload carries the full graph for quiz, question-projected flashcard, and package assertions.
 * Both payloads are built from canonical content so the clone path, relationship
 * assertions, and fixture freshness contract share the same source of truth.
 */

import { buildPackageForMaterial } from './studyPackageBuilder.mjs';

/**
 * Fixed timestamp for every fixture, so the committed payloads are stable
 * across runs. `metadata.createdAt` is required by the strict client validator
 * (`validateStudyPackage`), and the specs assert this exact value.
 */
export const E2E_FIXTURE_CREATED_AT = '2026-01-01T00:00:00.000Z';

/**
 * Fixture specs. Only the facts the *share surface* needs live here — the
 * package title and content come from canonical content, so there is nothing to
 * drift.
 */
export const E2E_SHARE_FIXTURES = [
  {
    key: 'cellStructure',
    /** Share id served by `GET /api/shares/:id`. */
    shareId: 'share_e2e_cell_structure',
    /** Canonical catalog entry id this fixture is built from. */
    materialId: 'cell-structure',
    /** Committed payload path, relative to tests/e2e/helpers/fixtures/. */
    fixtureFile: 'cell-structure.lcpack.json',
  },
  {
    key: 'cellularRespiration',
    /** Share id served by `GET /api/shares/:id`. */
    shareId: 'share_e2e_cellular_respiration',
    /** Canonical catalog entry id this fixture is built from. */
    materialId: 'cellular-respiration',
    /** Committed payload path, relative to tests/e2e/helpers/fixtures/. */
    fixtureFile: 'cellular-respiration.lcpack.json',
  },
];

export function getE2EShareFixture(key) {
  const spec = E2E_SHARE_FIXTURES.find((fixture) => fixture.key === key);
  if (!spec) {
    throw new Error(`Unknown E2E share fixture "${key}". Known: ${E2E_SHARE_FIXTURES.map((f) => f.key).join(', ')}`);
  }
  return spec;
}

/**
 * Builds one fixture's `.lcpack` payload from already-resolved canonical inputs.
 * The caller owns all file reads; this only pins the fixed `createdAt`.
 *
 * @returns Return type of `buildPackageForMaterial` — payload plus
 *   errors/warnings/counts/bytes.
 */
export function buildE2EShareFixture({ material, markdown, assets = [], questions, quizzes }) {
  return buildPackageForMaterial({
    material,
    markdown,
    assets,
    questions,
    quizzes,
    createdAt: E2E_FIXTURE_CREATED_AT,
  });
}
