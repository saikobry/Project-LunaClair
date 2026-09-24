#!/usr/bin/env node
/**
 * Phase 2 (Explore overhaul) — Asset Validation & Publisher Seeder.
 *
 * Transforms canonical catalog content into `.lcpack` StudyPackage payloads
 * matching `validateServerStudyPackage` (worker/src/routes/shares.ts) and the
 * stricter client-side validator (`validateStudyPackage`), then publishes them
 * as public shares via `POST /api/shares`.
 *
 * Sources (read-only, canonical):
 *   - content/catalog/materials.json            (metadata: title, description, tags)
 *   - content/materials/{id}/index.md           (markdown document content)
 *   - content/materials/{id}/images/*           (figure assets: png, jpg, svg, webp)
 *   - content/quiz/questions.json, quizzes.json (questions & quizzes per material)
 *
 * Payload size guard: every serialized package is measured with
 * Buffer.byteLength(JSON.stringify(payload)) AFTER base64 asset encoding and
 * must stay under MAX_SHARE_PAYLOAD_BYTES (5 MiB) — the same ceiling the Worker
 * enforces on POST /api/shares.
 *
 * Usage:
 *   node scripts/seed-shares.mjs --dry-run
 *   node scripts/seed-shares.mjs --local
 *   node scripts/seed-shares.mjs --remote
 *   node scripts/seed-shares.mjs --url https://example.com --token mysecret
 *   node scripts/seed-shares.mjs --remote --force   (delete + republish existing titles)
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const MATERIALS_DIR = resolve(ROOT_DIR, 'content', 'materials');
const CATALOG_DIR = resolve(ROOT_DIR, 'content', 'catalog');
const QUIZ_DIR = resolve(ROOT_DIR, 'content', 'quiz');

const MAX_SHARE_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5,242,880 bytes — mirrors worker/src/routes/shares.ts
const DEFAULT_LOCAL_URL = 'http://127.0.0.1:8787';
const REMOTE_URL = 'https://api.project-lunaclair.workers.dev';
const PUBLISHER_AUTHOR = 'Saiko Interactive';

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

const QUESTION_TYPES = new Set([
  'multiple_choice',
  'multiple_select',
  'true_false',
  'identification',
  'fill_in_blank',
]);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const SCOPED_ID_SUFFIX_PATTERN = /^[a-zA-Z0-9_-]+$/;

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

/**
 * Normalizes a tag list the way the app does (`src/shared/utils/tags.ts`,
 * mirrored here because this script is plain ESM and cannot import app TS):
 * trims, strips a leading '#', drops empties, and dedupes case-insensitively
 * while keeping the first casing seen.
 *
 * Import writes package tags onto the local material verbatim, so the package is
 * where normalization has to have already happened.
 */
function normalizeTagList(tags) {
  const seen = new Set();
  const out = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const cleaned = tag.trim().replace(/^#/, '');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function slugify(value) {
  const slug = String(value)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
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

/**
 * Rewrites local figure references (`images/{filename}` in markdown) to
 * package-scoped `lc-asset://pkg_asset_{slug}` URIs. Unresolvable references
 * are collected so the caller can fail loudly instead of shipping broken images.
 */
function rewriteAssetLinks(markdown, filenameToAssetId) {
  const unresolved = new Set();
  const content = markdown.replace(/(?:\.\/)?images\/([A-Za-z0-9._-]+)/g, (match, filename) => {
    const assetId = filenameToAssetId.get(filename);
    if (!assetId) {
      unresolved.add(filename);
      return match;
    }
    return `lc-asset://${assetId}`;
  });
  return { content, unresolved: [...unresolved] };
}

/**
 * Pure self-check mirroring the Worker's validateServerStudyPackage plus the
 * stricter client-side clone rules (strict ID suffixes, metadata.createdAt).
 */
function selfValidatePackage(payload) {
  const errors = [];

  if (payload.format !== 'lcpack') {
    errors.push(`format must be "lcpack" (got "${String(payload.format)}").`);
  }
  if (payload.schemaVersion !== 1) {
    errors.push(`schemaVersion must be 1 (got "${String(payload.schemaVersion)}").`);
  }

  const meta = payload.metadata;
  if (!meta || typeof meta.title !== 'string' || meta.title.trim().length === 0) {
    errors.push('metadata.title must be a non-empty string.');
  }
  if (!meta || typeof meta.createdAt !== 'string' || Number.isNaN(Date.parse(meta.createdAt))) {
    errors.push('metadata.createdAt must be an ISO date string (required by the client-side validator on clone).');
  }

  const seenIds = new Set();
  const ensureUniqueId = (id, kind) => {
    if (seenIds.has(id)) {
      errors.push(`Duplicate scoped ID "${id}" (${kind}).`);
    }
    seenIds.add(id);
  };

  const materialIds = new Set();
  for (const mat of payload.materials) {
    if (
      typeof mat.id !== 'string' ||
      !mat.id.startsWith('pkg_mat_') ||
      !SCOPED_ID_SUFFIX_PATTERN.test(mat.id.slice('pkg_mat_'.length))
    ) {
      errors.push(`Material ID "${String(mat.id)}" must match "pkg_mat_[a-zA-Z0-9_-]".`);
    } else {
      ensureUniqueId(mat.id, 'material');
      materialIds.add(mat.id);
    }
    if (typeof mat.title !== 'string' || mat.title.trim().length === 0) {
      errors.push(`Material "${String(mat.id)}" must have a non-empty title.`);
    }
    if (typeof mat.documentContent !== 'string') {
      errors.push(`Material "${String(mat.id)}" must have a documentContent string.`);
    }
    // Mirrors the client validator (validateStudyPackage) so a bad tag list
    // fails the seed run here rather than at import time on a user's device.
    if (
      mat.tags !== undefined &&
      (!Array.isArray(mat.tags) ||
        mat.tags.length === 0 ||
        mat.tags.some((t) => typeof t !== 'string' || t.trim().length === 0))
    ) {
      errors.push(`Material "${String(mat.id)}" tags must be a non-empty array of non-empty strings.`);
    }
  }

  const questionIds = new Set();
  for (const q of payload.questions) {
    if (
      typeof q.id !== 'string' ||
      !q.id.startsWith('pkg_q_') ||
      !SCOPED_ID_SUFFIX_PATTERN.test(q.id.slice('pkg_q_'.length))
    ) {
      errors.push(`Question ID "${String(q.id)}" must match "pkg_q_[a-zA-Z0-9_-]".`);
    } else {
      ensureUniqueId(q.id, 'question');
      questionIds.add(q.id);
    }
    if (!materialIds.has(q.materialId)) {
      errors.push(`Question "${String(q.id)}" references unknown material "${String(q.materialId)}".`);
    }
    if (!QUESTION_TYPES.has(q.type)) {
      errors.push(`Question "${String(q.id)}" has invalid type "${String(q.type)}".`);
    }
    if (typeof q.prompt !== 'string' || q.prompt.trim().length === 0) {
      errors.push(`Question "${String(q.id)}" must have a non-empty prompt.`);
    }
    if (!q.payload || typeof q.payload !== 'object' || Array.isArray(q.payload)) {
      errors.push(`Question "${String(q.id)}" must have a payload object.`);
    }
    if (!DIFFICULTIES.has(q.difficulty)) {
      errors.push(`Question "${String(q.id)}" has invalid difficulty "${String(q.difficulty)}".`);
    }
    if (typeof q.points !== 'number' || Number.isNaN(q.points) || q.points < 0) {
      errors.push(`Question "${String(q.id)}" must have non-negative numeric points.`);
    }
  }

  for (const quiz of payload.quizzes) {
    if (
      typeof quiz.id !== 'string' ||
      !quiz.id.startsWith('pkg_quiz_') ||
      !SCOPED_ID_SUFFIX_PATTERN.test(quiz.id.slice('pkg_quiz_'.length))
    ) {
      errors.push(`Quiz ID "${String(quiz.id)}" must match "pkg_quiz_[a-zA-Z0-9_-]".`);
    } else {
      ensureUniqueId(quiz.id, 'quiz');
    }
    if (!materialIds.has(quiz.materialId)) {
      errors.push(`Quiz "${String(quiz.id)}" references unknown material "${String(quiz.materialId)}".`);
    }
    if (typeof quiz.title !== 'string' || quiz.title.trim().length === 0) {
      errors.push(`Quiz "${String(quiz.id)}" must have a non-empty title.`);
    }
    for (const item of Array.isArray(quiz.items) ? quiz.items : []) {
      if (!questionIds.has(item.questionId)) {
        errors.push(`Quiz "${String(quiz.id)}" item references unknown question "${String(item.questionId)}".`);
      }
    }
  }

  const assetIds = new Set();
  for (const asset of payload.assets ?? []) {
    if (
      typeof asset.id !== 'string' ||
      !asset.id.startsWith('pkg_asset_') ||
      !SCOPED_ID_SUFFIX_PATTERN.test(asset.id.slice('pkg_asset_'.length))
    ) {
      errors.push(`Asset ID "${String(asset.id)}" must match "pkg_asset_[a-zA-Z0-9_-]".`);
    } else {
      ensureUniqueId(asset.id, 'asset');
      assetIds.add(asset.id);
    }
    if (typeof asset.filename !== 'string' || asset.filename.trim().length === 0) {
      errors.push(`Asset "${String(asset.id)}" must have a non-empty filename.`);
    }
    if (typeof asset.mimeType !== 'string' || asset.mimeType.trim().length === 0) {
      errors.push(`Asset "${String(asset.id)}" must have a non-empty mimeType.`);
    }
    if (typeof asset.dataBase64 !== 'string' || asset.dataBase64.length === 0) {
      errors.push(`Asset "${String(asset.id)}" must have non-empty dataBase64.`);
    }
    if (asset.materialId !== undefined && !materialIds.has(asset.materialId)) {
      errors.push(`Asset "${String(asset.id)}" references unknown material "${String(asset.materialId)}".`);
    }
  }

  const assetUriPattern = /lc-asset:\/\/(pkg_asset_[a-zA-Z0-9_-]+)/g;
  for (const mat of payload.materials) {
    if (typeof mat.documentContent !== 'string') continue;
    for (const match of mat.documentContent.matchAll(assetUriPattern)) {
      if (!assetIds.has(match[1])) {
        errors.push(`Material "${String(mat.id)}" references undeclared asset "lc-asset://${match[1]}".`);
      }
    }
  }

  return errors;
}

function buildPackageForMaterial(entry, allQuestions, allQuizzes) {
  const errors = [];
  const warnings = [];
  const materialId = `pkg_mat_${slugify(entry.id)}`;
  const dirName = entry.documentId || entry.id;
  const dirPath = join(MATERIALS_DIR, dirName);
  const mdPath = join(dirPath, 'index.md');

  // 1. Assets: encode figures as base64 with correct mimeType.
  const imagesDir = join(dirPath, 'images');
  const assets = [];
  const filenameToAssetId = new Map();
  if (existsSync(imagesDir)) {
    const usedSlugs = new Set();
    const files = readdirSync(imagesDir).filter((file) => statSync(join(imagesDir, file)).isFile());
    for (const filename of files) {
      const ext = extname(filename).toLowerCase();
      const mimeType = MIME_TYPES[ext];
      if (!mimeType) {
        warnings.push(`Skipped asset "${filename}" (unsupported extension "${ext || 'none'}").`);
        continue;
      }
      const stem = filename.slice(0, filename.length - ext.length);
      let slug = slugify(stem);
      let counter = 2;
      while (usedSlugs.has(slug)) {
        slug = `${slugify(stem)}-${counter++}`;
      }
      usedSlugs.add(slug);

      const assetId = `pkg_asset_${slug}`;
      filenameToAssetId.set(filename, assetId);
      assets.push({
        id: assetId,
        materialId,
        filename,
        mimeType,
        dataBase64: readFileSync(join(imagesDir, filename)).toString('base64'),
      });
    }
  }

  // 2. Document content with rewritten lc-asset:// links.
  let documentContent = '';
  if (!existsSync(mdPath)) {
    errors.push(`Missing document source: content/materials/${dirName}/index.md`);
  } else {
    const markdown = readFileSync(mdPath, 'utf8');
    const rewrite = rewriteAssetLinks(markdown, filenameToAssetId);
    documentContent = rewrite.content;
    for (const filename of rewrite.unresolved) {
      errors.push(
        `Markdown references "images/${filename}" but no such asset exists in content/materials/${dirName}/images/.`,
      );
    }
  }

  // 3. Published questions scoped to this material.
  const materialQuestions = allQuestions.filter((q) => q.materialId === entry.id);
  const publishedQuestions = materialQuestions.filter((q) => q.status === 'published');
  const skippedQuestionCount = materialQuestions.length - publishedQuestions.length;
  if (skippedQuestionCount > 0) {
    warnings.push(`Skipped ${skippedQuestionCount} non-published question(s).`);
  }
  const pkgQuestions = publishedQuestions.map((q) => ({
    id: `pkg_q_${slugify(q.id)}`,
    materialId,
    type: q.type,
    prompt: q.prompt,
    payload: q.payload,
    difficulty: q.difficulty,
    points: q.points,
    ...(q.explanation !== undefined ? { explanation: q.explanation } : {}),
    ...(Array.isArray(q.tags) ? { tags: q.tags } : {}),
  }));

  // 4. Published quizzes scoped to this material.
  const materialQuizzes = allQuizzes.filter((quiz) => quiz.materialId === entry.id);
  const publishedQuizzes = materialQuizzes.filter((quiz) => quiz.status === 'published');
  const skippedQuizCount = materialQuizzes.length - publishedQuizzes.length;
  if (skippedQuizCount > 0) {
    warnings.push(`Skipped ${skippedQuizCount} non-published quiz(zzes).`);
  }
  const pkgQuizzes = publishedQuizzes.map((quiz) => ({
    id: `pkg_quiz_${slugify(quiz.id)}`,
    materialId,
    title: quiz.title,
    ...(quiz.description !== undefined ? { description: quiz.description } : {}),
    ...(quiz.timeLimitSeconds != null ? { timeLimitSeconds: quiz.timeLimitSeconds } : {}),
    ...(quiz.passingPercentage != null ? { passingPercentage: quiz.passingPercentage } : {}),
    items: (Array.isArray(quiz.items) ? quiz.items : []).map((item) => ({
      questionId: `pkg_q_${slugify(item.questionId)}`,
      order: item.order,
      ...(item.points !== undefined ? { points: item.points } : {}),
    })),
  }));

  // 5. Material tags. An explicit catalog `tags` list wins; otherwise the
  // material ships untagged rather than borrowing its questions' topic index
  // (one course's published questions carry 60+ distinct tags — a question
  // index, not a material's tag set). Untagged is warned about below so the gap
  // is visible instead of silent.
  const materialTags = normalizeTagList(Array.isArray(entry.tags) ? entry.tags : []);
  if (materialTags.length === 0) {
    warnings.push(
      `Material "${entry.id}" has no tags: add a "tags" array to its content/catalog/materials.json entry.`,
    );
  }

  // 6. Assemble the StudyPackage payload.
  const pkgMaterial = {
    id: materialId,
    title: entry.title ?? dirName,
    ...(entry.description ? { description: entry.description } : {}),
    documentContent,
    ...(typeof entry.order === 'number' ? { order: entry.order } : {}),
    ...(materialTags.length > 0 ? { tags: materialTags } : {}),
  };

  const metadata = {
    title: entry.title ?? dirName,
    ...(entry.description ? { description: entry.description } : {}),
    author: PUBLISHER_AUTHOR,
    createdAt: new Date().toISOString(),
  };

  const payload = {
    format: 'lcpack',
    schemaVersion: 1,
    metadata,
    materials: [pkgMaterial],
    questions: pkgQuestions,
    quizzes: pkgQuizzes,
    ...(assets.length > 0 ? { assets } : {}),
  };

  // 7. Structural validation + payload size guard (after base64 encoding).
  errors.push(...selfValidatePackage(payload));

  const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  if (bytes > MAX_SHARE_PAYLOAD_BYTES) {
    errors.push(
      `Serialized payload is ${formatBytes(bytes)}, exceeding the ${formatBytes(MAX_SHARE_PAYLOAD_BYTES)} share ceiling ` +
        `(${Math.round((bytes / MAX_SHARE_PAYLOAD_BYTES) * 100)}% of the limit). ` +
        `Compress or reduce this material's figure assets before publishing.`,
    );
  }

  return {
    id: entry.id,
    title: metadata.title,
    payload,
    errors,
    warnings,
    counts: {
      questions: pkgQuestions.length,
      quizzes: pkgQuizzes.length,
      assets: assets.length,
    },
    bytes,
  };
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
  const results = catalogMaterials.map((entry) => buildPackageForMaterial(entry, questions, quizzes));

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
