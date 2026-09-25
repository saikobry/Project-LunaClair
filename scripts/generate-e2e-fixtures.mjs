#!/usr/bin/env node
/**
 * E2E share-fixture generator.
 *
 * Builds the `.lcpack` payloads the Playwright suite serves from its mocked
 * `/api/shares` routes, from canonical content, and writes them as committed
 * JSON under `tests/e2e/helpers/fixtures/`. The transform itself lives in
 * `scripts/lib/studyPackageBuilder.mjs` and the fixture specs in
 * `scripts/lib/e2eShareFixtures.mjs`; this file owns the file reads, the writes,
 * and the reporting.
 *
 * Fixtures are deterministic: `E2E_FIXTURE_CREATED_AT` is fixed, so re-running
 * this produces byte-identical output. `src/__tests__/e2eFixtures/` regenerates
 * through the same code path and fails if the committed payload drifts.
 *
 * Usage:
 *   node scripts/generate-e2e-fixtures.mjs
 *   npm run generate:e2e-fixtures
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { E2E_SHARE_FIXTURES, buildE2EShareFixture } from './lib/e2eShareFixtures.mjs';
import { formatBytes, resolveMaterialDir } from './lib/studyPackageBuilder.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const MATERIALS_DIR = resolve(ROOT_DIR, 'content', 'materials');
const CATALOG_DIR = resolve(ROOT_DIR, 'content', 'catalog');
const QUIZ_DIR = resolve(ROOT_DIR, 'content', 'quiz');
const FIXTURES_DIR = resolve(ROOT_DIR, 'tests', 'e2e', 'helpers', 'fixtures');

function readJson(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/** Reads one material's figure bytes; id assignment stays in the builder. */
function readMaterialAssets(imagesDir) {
  if (!existsSync(imagesDir)) return [];
  return readdirSync(imagesDir)
    .filter((file) => statSync(join(imagesDir, file)).isFile())
    .map((filename) => ({
      filename,
      dataBase64: readFileSync(join(imagesDir, filename)).toString('base64'),
    }));
}

function main() {
  const catalogMaterials = readJson(resolve(CATALOG_DIR, 'materials.json'));
  const questions = readJson(resolve(QUIZ_DIR, 'questions.json'));
  const quizzes = readJson(resolve(QUIZ_DIR, 'quizzes.json'));

  mkdirSync(FIXTURES_DIR, { recursive: true });
  console.log(`📦 Generating ${E2E_SHARE_FIXTURES.length} E2E share fixture(s)...`);

  const rows = [];
  const failures = [];

  for (const spec of E2E_SHARE_FIXTURES) {
    const material = catalogMaterials.find((entry) => entry.id === spec.materialId);
    if (!material) {
      failures.push(`${spec.key}: no catalog entry with id "${spec.materialId}".`);
      continue;
    }

    const dirPath = join(MATERIALS_DIR, resolveMaterialDir(material));
    const mdPath = join(dirPath, 'index.md');
    if (!existsSync(mdPath)) {
      failures.push(`${spec.key}: missing document source ${mdPath}.`);
      continue;
    }

    const result = buildE2EShareFixture({
      material,
      markdown: readFileSync(mdPath, 'utf8'),
      assets: readMaterialAssets(join(dirPath, 'images')),
      questions,
      quizzes,
    });

    if (result.errors.length > 0) {
      failures.push(`${spec.key}: ${result.errors.join(' | ')}`);
      continue;
    }

    const outPath = join(FIXTURES_DIR, spec.fixtureFile);
    writeFileSync(outPath, `${JSON.stringify(result.payload, null, 2)}\n`);

    for (const warning of result.warnings) {
      console.log(`⚠️  [${spec.key}] ${warning}`);
    }
    rows.push([
      spec.key,
      spec.shareId,
      result.title,
      String(result.counts.questions),
      String(result.counts.quizzes),
      String(result.counts.assets),
      formatBytes(result.bytes),
      outPath.replace(`${ROOT_DIR}\\`, '').replace(`${ROOT_DIR}/`, ''),
    ]);
  }

  const header = ['KEY', 'SHARE ID', 'TITLE', 'Q', 'QUIZ', 'ASSETS', 'SIZE', 'FILE'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const formatRow = (cells) =>
    cells.map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join('  ');

  console.log('');
  console.log(formatRow(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    console.log(formatRow(row));
  }

  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} fixture(s) failed to generate:`);
    for (const failure of failures) {
      console.error(`    - ${failure}`);
    }
    process.exit(1);
  }

  console.log(`\n✅ Wrote ${rows.length} fixture(s) to tests/e2e/helpers/fixtures/`);
}

try {
  main();
} catch (err) {
  console.error('\n❌ Fixture generation failed:', err.message);
  process.exit(1);
}
