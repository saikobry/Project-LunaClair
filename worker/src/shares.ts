/**
 * Cloud Sharing Service for LunaClair Worker (Phase 11C).
 *
 * Implements published immutable snapshot sharing:
 * - POST   /api/shares              → Validates & persists StudyPackage snapshot
 * - GET    /api/shares/:id          → Fetches published snapshot (with passcode protection)
 * - POST   /api/shares/:id/download → Increments download count
 * - DELETE /api/shares/:id          → Deletes share (owner-authenticated)
 */
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from './index';
import { shares } from './schema';

export const MAX_SHARE_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB max package size

export type ShareAccessType = 'public' | 'unlisted' | 'passcode';

export interface PublishShareRequest {
  package: unknown;
  accessType?: ShareAccessType;
  passcode?: string;
  expiresAt?: string;
}

export interface PublishShareResponse {
  id: string;
  format: 'lcpack';
  schemaVersion: number;
  title: string;
  description?: string;
  author?: string;
  accessType: ShareAccessType;
  shareUrl: string;
  createdAt: string;
}

export interface PublishedShareResponse {
  id: string;
  format: 'lcpack';
  schemaVersion: number;
  title: string;
  description?: string;
  author?: string;
  accessType: ShareAccessType;
  package: unknown;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  viewCount: number;
  downloadCount: number;
}

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

/**
 * Computes SHA-256 hex digest for passcode comparison.
 */
export async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time comparison for hex digest strings.
 */
export function timingSafeHashMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Server-side StudyPackage validator ensuring untrusted uploads conform to
 * format 'lcpack', schemaVersion 1, and relational graph integrity.
 */
export function validateServerStudyPackage(input: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { isValid: false, errors: ['Package must be a non-null object.'] };
  }

  const pkg = input as Record<string, unknown>;

  if (pkg.format !== 'lcpack') {
    errors.push(`Invalid package format: expected "lcpack", got "${String(pkg.format)}".`);
  }

  if (pkg.schemaVersion !== 1) {
    errors.push(`Unsupported schema version: expected 1, got "${String(pkg.schemaVersion)}".`);
  }

  if (!pkg.metadata || typeof pkg.metadata !== 'object' || Array.isArray(pkg.metadata)) {
    errors.push('Package metadata is required and must be an object.');
  } else {
    const meta = pkg.metadata as Record<string, unknown>;
    if (typeof meta.title !== 'string' || meta.title.trim().length === 0) {
      errors.push('Package metadata.title is required and must be non-empty.');
    }
  }

  if (!Array.isArray(pkg.materials) || pkg.materials.length === 0) {
    errors.push('Package must contain at least one material.');
  }

  if (!Array.isArray(pkg.questions)) {
    errors.push('Package questions must be an array.');
  }

  if (!Array.isArray(pkg.quizzes)) {
    errors.push('Package quizzes must be an array.');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const materials = pkg.materials as Array<Record<string, unknown>>;
  const questions = pkg.questions as Array<Record<string, unknown>>;
  const quizzes = pkg.quizzes as Array<Record<string, unknown>>;
  const flashcards = Array.isArray(pkg.flashcards) ? (pkg.flashcards as Array<Record<string, unknown>>) : [];
  const assets = Array.isArray(pkg.assets) ? (pkg.assets as Array<Record<string, unknown>>) : [];

  const materialIdSet = new Set<string>();
  const questionIdSet = new Set<string>();
  const assetIdSet = new Set<string>();
  const allIdSet = new Set<string>();

  // 1. Validate Materials
  materials.forEach((mat, idx) => {
    const id = mat.id;
    if (typeof id !== 'string' || !id.startsWith('pkg_mat_')) {
      errors.push(`Material at index ${idx} has invalid ID: must start with "pkg_mat_".`);
    } else if (allIdSet.has(id)) {
      errors.push(`Duplicate ID detected: "${id}".`);
    } else {
      allIdSet.add(id);
      materialIdSet.add(id);
    }

    if (typeof mat.title !== 'string' || mat.title.trim().length === 0) {
      errors.push(`Material "${String(id || idx)}" title is required.`);
    }

    if (typeof mat.documentContent !== 'string') {
      errors.push(`Material "${String(id || idx)}" documentContent must be a string.`);
    }
  });

  // 2. Validate Questions
  questions.forEach((q, idx) => {
    const id = q.id;
    if (typeof id !== 'string' || !id.startsWith('pkg_q_')) {
      errors.push(`Question at index ${idx} has invalid ID: must start with "pkg_q_".`);
    } else if (allIdSet.has(id)) {
      errors.push(`Duplicate ID detected: "${id}".`);
    } else {
      allIdSet.add(id);
      questionIdSet.add(id);
    }

    if (typeof q.materialId !== 'string' || !materialIdSet.has(q.materialId)) {
      errors.push(`Question "${String(id || idx)}" materialId "${String(q.materialId)}" does not exist in package.`);
    }

    if (typeof q.prompt !== 'string' || q.prompt.trim().length === 0) {
      errors.push(`Question "${String(id || idx)}" prompt is required.`);
    }
  });

  // 3. Validate Quizzes
  quizzes.forEach((quiz, idx) => {
    const id = quiz.id;
    if (typeof id !== 'string' || !id.startsWith('pkg_quiz_')) {
      errors.push(`Quiz at index ${idx} has invalid ID: must start with "pkg_quiz_".`);
    } else if (allIdSet.has(id)) {
      errors.push(`Duplicate ID detected: "${id}".`);
    } else {
      allIdSet.add(id);
    }

    if (typeof quiz.materialId !== 'string' || !materialIdSet.has(quiz.materialId)) {
      errors.push(`Quiz "${String(id || idx)}" materialId "${String(quiz.materialId)}" does not exist in package.`);
    }

    if (Array.isArray(quiz.items)) {
      quiz.items.forEach((item, itemIdx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`Quiz "${String(id || idx)}" item ${itemIdx} is invalid.`);
        } else {
          const itemObj = item as Record<string, unknown>;
          if (typeof itemObj.questionId !== 'string' || !questionIdSet.has(itemObj.questionId)) {
            errors.push(`Quiz "${String(id || idx)}" item references missing question "${String(itemObj.questionId)}".`);
          }
        }
      });
    }
  });

  // 4. Validate Flashcards
  flashcards.forEach((card, idx) => {
    const id = card.id;
    if (typeof id !== 'string' || !id.startsWith('pkg_card_')) {
      errors.push(`Flashcard at index ${idx} has invalid ID: must start with "pkg_card_".`);
    } else if (allIdSet.has(id)) {
      errors.push(`Duplicate ID detected: "${id}".`);
    } else {
      allIdSet.add(id);
    }

    if (typeof card.materialId !== 'string' || !materialIdSet.has(card.materialId)) {
      errors.push(`Flashcard "${String(id || idx)}" materialId "${String(card.materialId)}" does not exist in package.`);
    }
  });

  // 5. Validate Assets
  assets.forEach((asset, idx) => {
    const id = asset.id;
    if (typeof id !== 'string' || !id.startsWith('pkg_asset_')) {
      errors.push(`Asset at index ${idx} has invalid ID: must start with "pkg_asset_".`);
    } else if (allIdSet.has(id)) {
      errors.push(`Duplicate ID detected: "${id}".`);
    } else {
      allIdSet.add(id);
      assetIdSet.add(id);
    }

    if (typeof asset.dataBase64 !== 'string' || asset.dataBase64.length === 0) {
      errors.push(`Asset "${String(id || idx)}" dataBase64 must be non-empty.`);
    }
  });

  // 6. Validate Markdown Asset Links
  materials.forEach((mat) => {
    if (typeof mat.documentContent === 'string') {
      const matches = mat.documentContent.matchAll(/lc-asset:\/\/(pkg_asset_[a-zA-Z0-9_-]+)/g);
      for (const match of matches) {
        const assetId = match[1];
        if (!assetIdSet.has(assetId)) {
          errors.push(`Material "${String(mat.id)}" references undeclared asset "lc-asset://${assetId}".`);
        }
      }
    }
  });

  return { isValid: errors.length === 0, errors };
}

/**
 * POST /api/shares — Ingest and publish a StudyPackage snapshot.
 */
export async function handleCreateShare(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string> = {},
): Promise<Response> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return json({ error: 'Content-Type must be application/json' }, 415, corsHeaders);
  }

  const rawText = await request.text();
  if (rawText.length > MAX_SHARE_PAYLOAD_BYTES) {
    return json(
      {
        error: `Payload exceeds maximum permitted size of ${MAX_SHARE_PAYLOAD_BYTES / (1024 * 1024)}MB.`,
      },
      413,
      corsHeaders,
    );
  }

  let body: PublishShareRequest;
  try {
    body = JSON.parse(rawText);
  } catch {
    return json({ error: 'Invalid JSON payload in request body.' }, 400, corsHeaders);
  }

  const validation = validateServerStudyPackage(body.package);
  if (!validation.isValid) {
    return json(
      {
        error: 'StudyPackage validation failed.',
        details: validation.errors,
      },
      422,
      corsHeaders,
    );
  }

  const pkg = body.package as Record<string, unknown>;
  const meta = pkg.metadata as Record<string, unknown>;

  const accessType: ShareAccessType = body.accessType === 'passcode' || body.accessType === 'unlisted'
    ? body.accessType
    : 'public';

  let passcodeHash: string | null = null;
  if (accessType === 'passcode') {
    if (!body.passcode || typeof body.passcode !== 'string' || body.passcode.trim().length === 0) {
      return json({ error: 'Passcode is required when accessType is "passcode".' }, 400, corsHeaders);
    }
    passcodeHash = await hashPasscode(body.passcode);
  }

  // Derive user identity from Authorization or header
  const authHeader = request.headers.get('Authorization');
  let userId: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    userId = authHeader.substring(7).trim();
  } else {
    userId = request.headers.get('x-user-id');
  }

  // Generate D1 Share ID (separated from package-scoped IDs)
  const shareId = `share_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();
  const serializedPackage = JSON.stringify(pkg);

  const db = drizzle(env.DB);

  await db.insert(shares).values({
    id: shareId,
    format: 'lcpack',
    schemaVersion: 1,
    title: String(meta.title).trim(),
    description: typeof meta.description === 'string' ? meta.description.trim() : null,
    author: typeof meta.author === 'string' ? meta.author.trim() : null,
    accessType,
    passcodeHash,
    packagePayload: serializedPackage,
    userId,
    viewCount: 0,
    downloadCount: 0,
    expiresAt: body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
    createdAt: now,
    updatedAt: now,
  });

  const responseBody: PublishShareResponse = {
    id: shareId,
    format: 'lcpack',
    schemaVersion: 1,
    title: String(meta.title).trim(),
    description: typeof meta.description === 'string' ? meta.description.trim() : undefined,
    author: typeof meta.author === 'string' ? meta.author.trim() : undefined,
    accessType,
    shareUrl: `/share/${shareId}`,
    createdAt: now,
  };

  return json(responseBody, 201, corsHeaders);
}

/**
 * GET /api/shares/:id — Retrieve published StudyPackage snapshot.
 */
export async function handleGetShare(
  request: Request,
  env: Env,
  shareId: string,
  url: URL,
  corsHeaders: Record<string, string> = {},
): Promise<Response> {
  const db = drizzle(env.DB);

  const results = await db.select().from(shares).where(eq(shares.id, shareId)).limit(1);
  const record = results[0];

  if (!record) {
    return json({ error: `Share "${shareId}" not found.` }, 404, corsHeaders);
  }

  // Check expiration if set
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    return json({ error: `Share "${shareId}" has expired.` }, 410, corsHeaders);
  }

  // Handle Passcode Protection
  if (record.accessType === 'passcode' && record.passcodeHash) {
    const providedPasscode =
      request.headers.get('X-Share-Passcode') ||
      url.searchParams.get('passcode');

    if (!providedPasscode) {
      return json(
        {
          error: 'Passcode required to view this share.',
          requiresPasscode: true,
          title: record.title,
          author: record.author,
        },
        401,
        corsHeaders,
      );
    }

    const providedHash = await hashPasscode(providedPasscode);
    const matches = timingSafeHashMatch(providedHash, record.passcodeHash);

    if (!matches) {
      return json(
        {
          error: 'Invalid passcode.',
          requiresPasscode: true,
        },
        401,
        corsHeaders,
      );
    }
  }

  // Atomically increment view count
  try {
    await db
      .update(shares)
      .set({ viewCount: sql`${shares.viewCount} + 1` })
      .where(eq(shares.id, shareId));
  } catch {
    // Non-fatal if view count update fails
  }

  let parsedPackage: unknown;
  try {
    parsedPackage = JSON.parse(record.packagePayload);
  } catch {
    return json({ error: 'Corrupted package payload in share storage.' }, 500, corsHeaders);
  }

  const responseBody: PublishedShareResponse = {
    id: record.id,
    format: 'lcpack',
    schemaVersion: record.schemaVersion,
    title: record.title,
    description: record.description ?? undefined,
    author: record.author ?? undefined,
    accessType: record.accessType as ShareAccessType,
    package: parsedPackage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    viewCount: record.viewCount + 1,
    downloadCount: record.downloadCount,
  };

  return json(responseBody, 200, {
    'Cache-Control': 'no-store',
    ...corsHeaders,
  });
}

/**
 * POST /api/shares/:id/download — Increment download counter.
 */
export async function handleTrackShareDownload(
  env: Env,
  shareId: string,
  corsHeaders: Record<string, string> = {},
): Promise<Response> {
  const db = drizzle(env.DB);

  const results = await db.select().from(shares).where(eq(shares.id, shareId)).limit(1);
  const record = results[0];

  if (!record) {
    return json({ error: `Share "${shareId}" not found.` }, 404, corsHeaders);
  }

  await db
    .update(shares)
    .set({ downloadCount: sql`${shares.downloadCount} + 1` })
    .where(eq(shares.id, shareId));

  return json({ success: true, downloadCount: record.downloadCount + 1 }, 200, corsHeaders);
}

/**
 * DELETE /api/shares/:id — Delete published share (authenticated).
 */
export async function handleDeleteShare(
  request: Request,
  env: Env,
  shareId: string,
  corsHeaders: Record<string, string> = {},
): Promise<Response> {
  const db = drizzle(env.DB);

  const results = await db.select().from(shares).where(eq(shares.id, shareId)).limit(1);
  const record = results[0];

  if (!record) {
    return json({ error: `Share "${shareId}" not found.` }, 404, corsHeaders);
  }

  // Authorization check
  const authHeader = request.headers.get('Authorization');
  let token = '';
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  const isSeedToken = env.SEED_TOKEN && token === env.SEED_TOKEN;
  const isOwner = record.userId && (token === record.userId || request.headers.get('x-user-id') === record.userId);

  if (!isSeedToken && !isOwner) {
    return json({ error: 'Unauthorized to delete this share.' }, 403, corsHeaders);
  }

  await db.delete(shares).where(eq(shares.id, shareId));

  return new Response(null, { status: 204, headers: corsHeaders });
}
