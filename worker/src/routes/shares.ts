/**
 * Cloud Sharing Service for LunaClair Worker (Phase 11C).
 *
 * Implements published immutable snapshot sharing:
 * - POST   /api/shares              → Validates & persists StudyPackage snapshot
 * - GET    /api/shares/:id          → Fetches published snapshot (with passcode protection)
 * - POST   /api/shares/:id/download → Increments download count
 * - DELETE /api/shares/:id          → Deletes share (owner-authenticated)
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Env, RouteContext } from '../core/types';
import { shares } from '../schema';

export const MAX_SHARE_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB max package size

export type ShareAccessType = 'public' | 'unlisted' | 'passcode';

export interface PublicShareSummary {
  id: string;
  format: 'lcpack';
  schemaVersion: number;
  title: string;
  description?: string;
  author?: string;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
}

export interface ListPublicSharesResponse {
  items: PublicShareSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

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

    if (mat.tags !== undefined && (!Array.isArray(mat.tags) || mat.tags.some((t) => typeof t !== 'string'))) {
      errors.push(`Material "${String(id || idx)}" tags must be an array of strings.`);
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

    // Optional provenance label (the section the question was generated from). Additive:
    // absence is valid and stays valid, matching the client validator exactly — the two
    // must agree or a package the app can clone would be refused at publish time.
    if (q.sourceSection !== undefined && typeof q.sourceSection !== 'string') {
      errors.push(`Question "${String(id || idx)}" sourceSection must be a string.`);
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
  ctxOrRequest: RouteContext | Request,
  maybeEnv?: Env,
  maybeCorsHeaders?: Record<string, string>,
): Promise<Response> {
  const request = 'request' in ctxOrRequest ? ctxOrRequest.request : ctxOrRequest;
  const env = 'env' in ctxOrRequest ? ctxOrRequest.env : maybeEnv!;
  const corsHeaders = 'corsHeaders' in ctxOrRequest ? ctxOrRequest.corsHeaders : (maybeCorsHeaders ?? {});

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
  ctxOrRequest: RouteContext | Request,
  maybeEnv?: Env,
  maybeShareId?: string,
  maybeUrl?: URL,
  maybeCorsHeaders?: Record<string, string>,
): Promise<Response> {
  const request = 'request' in ctxOrRequest ? ctxOrRequest.request : ctxOrRequest;
  const env = 'env' in ctxOrRequest ? ctxOrRequest.env : maybeEnv!;
  const shareId = 'params' in ctxOrRequest ? ctxOrRequest.params.id : maybeShareId!;
  const url = 'url' in ctxOrRequest && ctxOrRequest.url instanceof URL ? ctxOrRequest.url : (maybeUrl instanceof URL ? maybeUrl : new URL(request.url));
  const corsHeaders = 'corsHeaders' in ctxOrRequest ? ctxOrRequest.corsHeaders : (maybeCorsHeaders ?? {});

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
  ctxOrEnv: RouteContext | Env,
  maybeShareId?: string,
  maybeCorsHeaders?: Record<string, string>,
): Promise<Response> {
  const env = 'env' in ctxOrEnv ? ctxOrEnv.env : ctxOrEnv;
  const shareId = 'params' in ctxOrEnv ? ctxOrEnv.params.id : maybeShareId!;
  const corsHeaders = 'corsHeaders' in ctxOrEnv ? ctxOrEnv.corsHeaders : (maybeCorsHeaders ?? {});

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
  ctxOrRequest: RouteContext | Request,
  maybeEnv?: Env,
  maybeShareId?: string,
  maybeCorsHeaders?: Record<string, string>,
): Promise<Response> {
  const request = 'request' in ctxOrRequest ? ctxOrRequest.request : ctxOrRequest;
  const env = 'env' in ctxOrRequest ? ctxOrRequest.env : maybeEnv!;
  const shareId = 'params' in ctxOrRequest ? ctxOrRequest.params.id : maybeShareId!;
  const corsHeaders = 'corsHeaders' in ctxOrRequest ? ctxOrRequest.corsHeaders : (maybeCorsHeaders ?? {});

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

interface PopularCursorPayload {
  downloadCount?: number;
  dl?: number;
  viewCount?: number;
  vw?: number;
  createdAt?: string;
  ca?: string;
  id?: string;
}

interface RecentCursorPayload {
  createdAt?: string;
  ca?: string;
  id?: string;
}

function encodeCursor(obj: unknown): string {
  const jsonStr = JSON.stringify(obj);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(jsonStr, 'utf-8').toString('base64');
  }
  return btoa(jsonStr);
}

function decodeCursor<T>(cursor: string): T | null {
  try {
    let jsonStr: string;
    if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(cursor, 'base64').toString('utf-8');
    } else {
      jsonStr = atob(cursor);
    }
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

/**
 * GET /api/shares — Discovery feed for public StudyPackages with keyset pagination.
 */
export async function handleListPublicShares(
  ctxOrRequest: RouteContext | Request,
  maybeEnv?: Env,
  maybeUrl?: URL,
  maybeCorsHeaders?: Record<string, string>,
): Promise<Response> {
  const request = 'request' in ctxOrRequest ? ctxOrRequest.request : ctxOrRequest;
  const env = 'env' in ctxOrRequest ? ctxOrRequest.env : maybeEnv!;
  const url = 'url' in ctxOrRequest && ctxOrRequest.url instanceof URL ? ctxOrRequest.url : (maybeUrl instanceof URL ? maybeUrl : new URL(request.url));
  const corsHeaders = 'corsHeaders' in ctxOrRequest ? ctxOrRequest.corsHeaders : (maybeCorsHeaders ?? {});

  const db = drizzle(env.DB);

  // 1. Parse Query Parameters
  const rawQ = url.searchParams.get('q');
  const q = rawQ ? rawQ.trim().slice(0, 100) : '';

  const sortParam = url.searchParams.get('sort');
  const sort = sortParam === 'recent' ? 'recent' : 'popular';

  const rawLimit = Number(url.searchParams.get('limit'));
  const limit = !Number.isNaN(rawLimit) && rawLimit >= 1 ? Math.min(Math.floor(rawLimit), 50) : 20;

  const rawCursor = url.searchParams.get('cursor');

  // 2. Base Security & Privacy Conditions:
  // - ONLY access_type = 'public'
  // - NOT expired (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
  const conditions = [
    eq(shares.accessType, 'public'),
    sql`(${shares.expiresAt} IS NULL OR datetime(${shares.expiresAt}) > datetime('now'))`,
  ];

  // 3. Search Filter (title, description, author)
  if (q.length >= 1) {
    // Escape LIKE wildcards so user input is treated literally; '\' is the escape char.
    const escapedQ = q.replace(/[\\%_]/g, '\\$&');
    const searchPattern = `%${escapedQ}%`;
    conditions.push(
      sql`(${shares.title} LIKE ${searchPattern} ESCAPE '\\' OR ${shares.description} LIKE ${searchPattern} ESCAPE '\\' OR ${shares.author} LIKE ${searchPattern} ESCAPE '\\')`,
    );
  }

  // 4. Cursor Keyset Predicates
  if (rawCursor) {
    if (sort === 'popular') {
      const parsed = decodeCursor<PopularCursorPayload>(rawCursor);
      const dl = parsed?.dl ?? parsed?.downloadCount;
      const vw = parsed?.vw ?? parsed?.viewCount;
      const ca = parsed?.ca ?? parsed?.createdAt;
      const id = parsed?.id;

      if (typeof dl !== 'number' || typeof vw !== 'number' || typeof ca !== 'string' || typeof id !== 'string') {
        return json({ error: 'Invalid cursor parameter for popular sort.' }, 400, corsHeaders);
      }

      conditions.push(
        sql`(
          (${shares.downloadCount} < ${dl}) OR
          (${shares.downloadCount} = ${dl} AND ${shares.viewCount} < ${vw}) OR
          (${shares.downloadCount} = ${dl} AND ${shares.viewCount} = ${vw} AND ${shares.createdAt} < ${ca}) OR
          (${shares.downloadCount} = ${dl} AND ${shares.viewCount} = ${vw} AND ${shares.createdAt} = ${ca} AND ${shares.id} < ${id})
        )`,
      );
    } else {
      // sort === 'recent'
      const parsed = decodeCursor<RecentCursorPayload>(rawCursor);
      const ca = parsed?.ca ?? parsed?.createdAt;
      const id = parsed?.id;

      if (typeof ca !== 'string' || typeof id !== 'string') {
        return json({ error: 'Invalid cursor parameter for recent sort.' }, 400, corsHeaders);
      }

      conditions.push(
        sql`(
          (${shares.createdAt} < ${ca}) OR
          (${shares.createdAt} = ${ca} AND ${shares.id} < ${id})
        )`,
      );
    }
  }

  // 5. Query execution with limit + 1
  const query = db
    .select({
      id: shares.id,
      format: shares.format,
      schemaVersion: shares.schemaVersion,
      title: shares.title,
      description: shares.description,
      author: shares.author,
      viewCount: shares.viewCount,
      downloadCount: shares.downloadCount,
      createdAt: shares.createdAt,
    })
    .from(shares)
    .where(and(...conditions));

  const rows = sort === 'popular'
    ? await query
        .orderBy(desc(shares.downloadCount), desc(shares.viewCount), desc(shares.createdAt), desc(shares.id))
        .limit(limit + 1)
    : await query
        .orderBy(desc(shares.createdAt), desc(shares.id))
        .limit(limit + 1);

  const hasMore = rows.length > limit;
  const itemsRows = hasMore ? rows.slice(0, limit) : rows;

  const items: PublicShareSummary[] = itemsRows.map((row) => ({
    id: row.id,
    format: 'lcpack',
    schemaVersion: row.schemaVersion,
    title: row.title,
    description: row.description ?? undefined,
    author: row.author ?? undefined,
    viewCount: row.viewCount,
    downloadCount: row.downloadCount,
    createdAt: row.createdAt,
  }));

  let nextCursor: string | null = null;
  if (hasMore && itemsRows.length > 0) {
    const lastItem = itemsRows[itemsRows.length - 1];
    if (sort === 'popular') {
      nextCursor = encodeCursor({
        downloadCount: lastItem.downloadCount,
        dl: lastItem.downloadCount,
        viewCount: lastItem.viewCount,
        vw: lastItem.viewCount,
        createdAt: lastItem.createdAt,
        ca: lastItem.createdAt,
        id: lastItem.id,
      });
    } else {
      nextCursor = encodeCursor({
        createdAt: lastItem.createdAt,
        ca: lastItem.createdAt,
        id: lastItem.id,
      });
    }
  }

  const responseBody: ListPublicSharesResponse = {
    items,
    nextCursor,
    hasMore,
  };

  return json(responseBody, 200, {
    'Cache-Control': 'no-store',
    ...corsHeaders,
  });
}
