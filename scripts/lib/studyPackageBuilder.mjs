/**
 * Pure `.lcpack` StudyPackage builder.
 *
 * This module owns the deterministic transformation from canonical content into
 * a package payload: `pkg_*` identifier generation, asset-link rewriting, tag
 * propagation, structural self-validation, and the payload size guard.
 *
 * It deliberately has **no filesystem, network, process, or import-time side
 * effects**. Everything variable — file bytes, document markdown, timestamps,
 * author — is passed in by the caller. `scripts/seed-shares.mjs` owns reading
 * `content/**` from disk, argument parsing, and publishing over HTTP; this module
 * is safe to `import` from anywhere, including tests.
 *
 * Payload size guard: the serialized package is measured with
 * `Buffer.byteLength(JSON.stringify(payload))` AFTER base64 asset encoding and
 * must stay under `MAX_SHARE_PAYLOAD_BYTES` (5 MiB) — the same ceiling the Worker
 * enforces on `POST /api/shares`.
 */

import { extname } from 'node:path';
import { validateQuestionPayload } from '../../src/domain/quiz/validation/questionPayloadValidation.ts';

export const MAX_SHARE_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5,242,880 bytes — mirrors worker/src/routes/shares.ts
export const PUBLISHER_AUTHOR = 'Saiko Interactive';

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

export function slugify(value) {
  const slug = String(value)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

/**
 * Single owner of the rule for which `content/materials/<dir>` a catalog entry
 * points at. Callers that read from disk (`seed-shares.mjs`, the fixture
 * generator, tests) must use this rather than re-deriving it, so a `documentId`
 * override can never drift between them.
 */
export function resolveMaterialDir(entry) {
  return entry.documentId || entry.id;
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

/**
 * Normalizes a tag list the way the app does (`src/shared/utils/tags.ts`,
 * mirrored here because this module is plain ESM and cannot import app TS):
 * trims, strips a leading '#', drops empties, and dedupes case-insensitively
 * while keeping the first casing seen.
 *
 * Import writes package tags onto the local material verbatim, so the package is
 * where normalization has to have already happened.
 */
export function normalizeTagList(tags) {
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

/**
 * Rewrites local figure references (`images/{filename}` in markdown) to
 * package-scoped `lc-asset://pkg_asset_{slug}` URIs. Unresolvable references are
 * collected so the caller can fail loudly instead of shipping broken images.
 */
export function rewriteAssetLinks(markdown, filenameToAssetId) {
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
 * stricter client-side clone rules (strict ID suffixes, metadata.createdAt, and
 * the per-type question payload rules).
 *
 * The payload rules are NOT restated here: they are imported from
 * `src/domain/quiz/validation/questionPayloadValidation.ts`, the same module the
 * client's `validateStudyPackage` and the Worker's mirrored copy are written
 * against. The dry run used to be payload-shape-generic, so it could report a
 * package PASS that `POST /api/shares` would then refuse — most visibly a cloze
 * whose `___` count disagreed with its `blanks.length`, which nothing here ever
 * looked at. Failing here is the point: the alternative is a failed publish after
 * a round trip.
 */
export function selfValidatePackage(payload) {
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
    // Per-type payload structure, owned by the domain validator and mirrored by the Worker. The
    // same two guards `validateStudyPackage` applies keep this from double-reporting: an unknown
    // question type is already an error above, and a payload that is not an object is already an
    // error above too — and the validator's own switch has no branch for an unknown type, so
    // calling it with one would yield `undefined` rather than a list of findings.
    if (QUESTION_TYPES.has(q.type) && q.payload && typeof q.payload === 'object' && !Array.isArray(q.payload)) {
      for (const issue of validateQuestionPayload(q.type, q.payload)) {
        errors.push(`Question "${String(q.id)}": ${issue}`);
      }
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

/**
 * Assembles one material's `.lcpack` payload from already-resolved inputs.
 *
 * Pure: the caller performs all file reads (document markdown, figure bytes) and
 * supplies the wall-clock `createdAt`, which keeps fixture generation
 * deterministic. Returns the payload plus the errors/warnings/counts/size the
 * CLI reports, so no caller has to re-derive them.
 *
 * Figure bytes arrive as `assets: [{ filename, dataBase64 }]`; this function
 * derives each `pkg_asset_*` id, builds the filename→asset map, and rewrites the
 * markdown's `images/...` links against it.
 *
 * @returns {{ id, title, payload, errors: string[], warnings: string[], counts: { questions: number, quizzes: number, assets: number }, bytes: number }}
 */
export function buildPackageForMaterial({
  material,
  markdown,
  assets = [],
  questions = [],
  quizzes = [],
  createdAt,
  author = PUBLISHER_AUTHOR,
} = {}) {
  const errors = [];
  const warnings = [];
  const entry = material;
  const materialId = `pkg_mat_${slugify(entry.id)}`;
  const dirName = resolveMaterialDir(entry);

  // 1. Assets: assign package-scoped ids; bytes were read by the caller.
  const resolvedAssets = [];
  const filenameToAssetId = new Map();
  const usedSlugs = new Set();
  for (const file of assets) {
    const filename = file.filename;
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
    resolvedAssets.push({
      id: assetId,
      materialId,
      filename,
      mimeType,
      dataBase64: file.dataBase64,
    });
  }

  // 2. Document content with rewritten lc-asset:// links.
  let documentContent = '';
  if (typeof markdown === 'string') {
    const rewrite = rewriteAssetLinks(markdown, filenameToAssetId);
    documentContent = rewrite.content;
    for (const filename of rewrite.unresolved) {
      errors.push(
        `Markdown references "images/${filename}" but no such asset exists in content/materials/${dirName}/images/.`,
      );
    }
  }

  // 3. Published questions scoped to this material.
  const materialQuestions = questions.filter((q) => q.materialId === entry.id);
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
  const materialQuizzes = quizzes.filter((quiz) => quiz.materialId === entry.id);
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
    author,
    createdAt,
  };

  const payload = {
    format: 'lcpack',
    schemaVersion: 1,
    metadata,
    materials: [pkgMaterial],
    questions: pkgQuestions,
    quizzes: pkgQuizzes,
    ...(resolvedAssets.length > 0 ? { assets: resolvedAssets } : {}),
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
      assets: resolvedAssets.length,
    },
    bytes,
  };
}
