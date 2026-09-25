#!/usr/bin/env node
/**
 * Publisher seeder — Asset Validation & Publishing CLI.
 *
 * Transforms canonical catalog content into `.lcpack` StudyPackage payloads and
 * publishes them as public shares via `POST /api/shares`. The payload shape
 * matching `validateServerStudyPackage` (worker/src/routes/shares.ts) and the
 * stricter client-side validator (`validateStudyPackage`) is owned by
 * `scripts/lib/studyPackageBuilder.mjs`; this file owns filesystem loading,
 * argument parsing, and publishing.
 *
 * Sources (read-only, canonical):
 *   - content/catalog/materials.json            (metadata: title, description, tags)
 *   - content/materials/{id}/index.md           (markdown document content)
 *   - content/materials/{id}/images/*           (figure assets: png, jpg, svg, webp)
 *   - content/quiz/questions.json, quizzes.json (questions & quizzes per material)
 *
 * Payload size guard: every serialized package is measured AFTER base64 asset
 * encoding and must stay under MAX_SHARE_PAYLOAD_BYTES (5 MiB) — the same ceiling
 * the Worker enforces on POST /api/shares.
 *
 * Usage:
 *   node scripts/seed-shares.mjs --dry-run
 *   node scripts/seed-shares.mjs --local
 *   node scripts/seed-shares.mjs --remote
 *   node scripts/seed-shares.mjs --url https://example.com --token mysecret
 *   node scripts/seed-shares.mjs --remote --force   (delete + republish existing titles)
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_SHARE_PAYLOAD_BYTES,
  buildPackageForMaterial,
  formatBytes,
  resolveMaterialDir,
} from './lib/studyPackageBuilder.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const MATERIALS_DIR = resolve(ROOT_DIR, 'content', 'materials');
const CATALOG_DIR = resolve(ROOT_DIR, 'content', 'catalog');
const QUIZ_DIR = resolve(ROOT_DIR, 'content', 'quiz');

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:8787';
const REMOTE_URL = 'https://api.project-lunaclair.workers.dev';

function parseArgs() {
  const args = process.argv.slice(2);
  let target = 'local';
  let customUrl = null;
  let customToken = null;
  let dryRun = false;
  let force = false;
  let dumpDir = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--remote') {
      target = 'remote';
    } else if (arg === '--local') {
      target = 'local';
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--dump-dir' && args[i + 1]) {
      dumpDir = args[++i];
    } else if ((arg === '--url' || arg === '--base-url') && args[i + 1]) {
      customUrl = args[++i];
    } else if (arg === '--token' && args[i + 1]) {
      customToken = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/seed-shares.mjs [options]

Builds .lcpack study packages from canonical content and publishes them as
public shares (POST /api/shares). Every package is validated and checked
against the ${formatBytes(MAX_SHARE_PAYLOAD_BYTES)} share ceiling before publishing.

Options:
  --local             Target local dev Worker (${DEFAULT_LOCAL_URL}) [default]
  --remote            Target deployed production Worker (${REMOTE_URL})
  --dry-run           Validate + report sizes only; publish nothing
  --force             Delete and re-publish shares whose title already exists
  --dump-dir <dir>    Debug: write each built package payload as <materialId>.json
  --url <url>         Specify custom Worker API base URL (alias: --base-url)
  --token <token>     Specify SEED_TOKEN (defaults to SEED_TOKEN env var or .dev.vars)
  --help, -h          Show this help message

Environment:
  SEED_SHARES_URL     Fallback base URL when --url/--local/--remote are absent
  SEED_TOKEN          Bearer token for publishing (publish mode only)

Oversized or invalid packages are reported loudly and skipped; the process
still exits non-zero when any package fails.
`);
      process.exit(0);
    }
  }

  return { target, customUrl, customToken, dryRun, force, dumpDir };
}

function getSeedToken(customToken) {
  if (customToken) return customToken;
  if (process.env.SEED_TOKEN) return process.env.SEED_TOKEN.trim();

  const devVarsPath = resolve(ROOT_DIR, '.dev.vars');
  if (existsSync(devVarsPath)) {
    const content = readFileSync(devVarsPath, 'utf8');
    const match = content.match(/^SEED_TOKEN\s*=\s*(.+)$/m);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  throw new Error(
    'Missing SEED_TOKEN. Pass --token <token>, set SEED_TOKEN in environment, or define SEED_TOKEN in .dev.vars',
  );
}

function loadCatalogMaterials() {
  const filePath = resolve(CATALOG_DIR, 'materials.json');
  if (!existsSync(filePath)) {
    throw new Error(`Missing catalog file: ${filePath}`);
  }
  const materials = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!Array.isArray(materials) || materials.length === 0) {
    throw new Error(`Catalog file must contain a non-empty JSON array: ${filePath}`);
  }
  return materials;
}

function loadQuizContent() {
  const readArray = (name) => {
    const filePath = resolve(QUIZ_DIR, `${name}.json`);
    if (!existsSync(filePath)) {
      console.warn(`⚠️  Missing quiz file content/quiz/${name}.json — continuing without it.`);
      return [];
    }
    const rows = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(rows)) {
      throw new Error(`Quiz file must contain a JSON array: ${filePath}`);
    }
    return rows;
  };
  return { questions: readArray('questions'), quizzes: readArray('quizzes') };
}

/** Reads one material's on-disk figure bytes, leaving id assignment to the builder. */
function readMaterialAssets(imagesDir) {
  if (!existsSync(imagesDir)) return [];
  return readdirSync(imagesDir)
    .filter((file) => statSync(join(imagesDir, file)).isFile())
    .map((filename) => ({
      filename,
      dataBase64: readFileSync(join(imagesDir, filename)).toString('base64'),
    }));
}

/**
 * Filesystem half of the build: reads one material's markdown and figure bytes,
 * then hands them to the pure builder. The caller supplies `createdAt` so the
 * builder stays deterministic.
 */
function createPackageForMaterial(entry, allQuestions, allQuizzes, createdAt) {
  const dirName = resolveMaterialDir(entry);
  const dirPath = join(MATERIALS_DIR, dirName);
  const mdPath = join(dirPath, 'index.md');

  const assets = readMaterialAssets(join(dirPath, 'images'));

  let markdown = null;
  const fsErrors = [];
  if (!existsSync(mdPath)) {
    fsErrors.push(`Missing document source: content/materials/${dirName}/index.md`);
  } else {
    markdown = readFileSync(mdPath, 'utf8');
  }

  const result = buildPackageForMaterial({
    material: entry,
    markdown,
    assets,
    questions: allQuestions,
    quizzes: allQuizzes,
    createdAt,
  });

  result.errors.unshift(...fsErrors);
  return result;
}

function printReport(results) {
  const header = ['MATERIAL', 'Q', 'QUIZ', 'ASSETS', 'SIZE', 'LIMIT', 'STATUS'];
  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0);
  const passedCount = results.filter((r) => r.errors.length === 0).length;

  const rows = results.map((r) => [
    r.id,
    String(r.counts.questions),
    String(r.counts.quizzes),
    String(r.counts.assets),
    formatBytes(r.bytes),
    `${Math.round((r.bytes / MAX_SHARE_PAYLOAD_BYTES) * 100)}%`,
    r.errors.length === 0 ? 'PASS' : 'FAIL',
  ]);
  rows.push([
    'TOTAL',
    String(results.reduce((sum, r) => sum + r.counts.questions, 0)),
    String(results.reduce((sum, r) => sum + r.counts.quizzes, 0)),
    String(results.reduce((sum, r) => sum + r.counts.assets, 0)),
    formatBytes(totalBytes),
    `${Math.round((totalBytes / MAX_SHARE_PAYLOAD_BYTES) * 100)}%`,
    `${passedCount}/${results.length} pass`,
  ]);

  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const formatRow = (cells) =>
    cells.map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join('  ');

  console.log('');
  console.log(formatRow(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    console.log(formatRow(row));
  }

  console.log(`\nCeiling: ${formatBytes(MAX_SHARE_PAYLOAD_BYTES)} per package (MAX_SHARE_PAYLOAD_BYTES).`);
}

async function safeResponseText(res) {
  try {
    return await res.text();
  } catch {
    return '<no response body>';
  }
}

/**
 * Idempotent publish: skip when a public share with the identical title already
 * exists, delete + re-publish with --force, otherwise POST a fresh share.
 */
async function publishPackage(baseUrl, token, payload, force) {
  const title = payload.metadata.title;

  const searchRes = await fetch(
    `${baseUrl}/api/shares?q=${encodeURIComponent(title)}&limit=50`,
  );
  if (!searchRes.ok) {
    throw new Error(`Share lookup failed (${searchRes.status}): ${await safeResponseText(searchRes)}`);
  }
  const searchBody = await searchRes.json();
  const items = Array.isArray(searchBody?.items) ? searchBody.items : [];
  const existing = items.find((item) => item.title === title);

  if (existing && !force) {
    return { status: 'skipped', id: existing.id };
  }

  if (existing && force) {
    const delRes = await fetch(`${baseUrl}/api/shares/${encodeURIComponent(existing.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!delRes.ok && delRes.status !== 404) {
      throw new Error(
        `Failed to delete existing share ${existing.id} (${delRes.status}): ${await safeResponseText(delRes)}`,
      );
    }
  }

  const res = await fetch(`${baseUrl}/api/shares`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ package: payload, accessType: 'public' }),
  });

  if (!res.ok) {
    const text = await safeResponseText(res);
    let details = text;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.details) && parsed.details.length > 0) {
        details = `${parsed.error} — ${parsed.details.join(' | ')}`;
      } else if (parsed.error) {
        details = parsed.error;
      }
    } catch {
      // Keep raw text as details.
    }
    throw new Error(`POST /api/shares failed (${res.status}): ${details}`);
  }

  const body = await res.json();
  return { status: 'published', id: body.id, shareUrl: body.shareUrl };
}

function dumpPackages(dumpDir, results) {
  mkdirSync(dumpDir, { recursive: true });
  for (const result of results) {
    writeFileSync(join(dumpDir, `${result.id}.json`), JSON.stringify(result.payload, null, 2));
  }
}

async function main() {
  const { target, customUrl, customToken, dryRun, force, dumpDir } = parseArgs();

  let baseUrl =
    customUrl ??
    process.env.SEED_SHARES_URL ??
    (target === 'remote' ? REMOTE_URL : DEFAULT_LOCAL_URL);
  baseUrl = baseUrl.replace(/\/+$/, '');

  const catalogMaterials = loadCatalogMaterials();
  const { questions, quizzes } = loadQuizContent();

  console.log(`📦 Building ${catalogMaterials.length} study packages from canonical content...`);
  const createdAt = new Date().toISOString();
  const results = catalogMaterials.map((entry) =>
    createPackageForMaterial(entry, questions, quizzes, createdAt),
  );

  printReport(results);

  for (const result of results) {
    for (const warning of result.warnings) {
      console.log(`⚠️  [${result.id}] ${warning}`);
    }
  }

  const failures = results.filter((r) => r.errors.length > 0);
  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} package(s) failed validation or the size guard:`);
    for (const failure of failures) {
      console.error(`\n  ${failure.id}:`);
      for (const error of failure.errors) {
        console.error(`    - ${error}`);
      }
    }
  }

  if (dumpDir) {
    dumpPackages(dumpDir, results);
    console.log(`\n💾 Dumped ${results.length} package payloads to ${dumpDir}`);
  }

  if (dryRun) {
    console.log('\n🏃 Dry run complete — nothing was published.');
    if (failures.length > 0) {
      process.exit(1);
    }
    return;
  }

  const token = getSeedToken(customToken);
  console.log(`\n🚀 Publishing to: ${baseUrl} (${target} mode)`);

  let publishedCount = 0;
  let skippedExistingCount = 0;
  let failedCount = failures.length;

  for (const result of results) {
    if (result.errors.length > 0) {
      console.log(`  ⚠️  [${result.id}] skipped — failed validation/size guard (see report above).`);
      continue;
    }
    try {
      const outcome = await publishPackage(baseUrl, token, result.payload, force);
      if (outcome.status === 'published') {
        publishedCount++;
        console.log(`  ✅ [${result.id}] published ${outcome.id} → ${outcome.shareUrl} (${formatBytes(result.bytes)})`);
      } else {
        skippedExistingCount++;
        console.log(`  ⏭️  [${result.id}] already published as ${outcome.id} — skipping (use --force to republish).`);
      }
    } catch (err) {
      failedCount++;
      console.log(`  ❌ [${result.id}] publish failed — ${err.message}`);
    }
  }

  console.log(
    `\n✅ Done: ${publishedCount} published, ${skippedExistingCount} skipped (existing), ${failedCount} failed.`,
  );
  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Seeding failed:', err.message);
  process.exit(1);
});
