import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { decodeSegment } from '../core/path';
import { badRequest, json, notFound, unauthorized } from '../core/responses';
import { extractBearerToken, tokensMatch } from '../core/security';
import type { RouteContext } from '../core/types';
import { documents } from '../schema';

/**
 * GET /api/documents/:documentId
 * Public document fetch ({ id, title, content }), cached for 1 hour.
 */
export async function handleGetDocument(ctx: RouteContext): Promise<Response> {
  const { env, params, corsHeaders } = ctx;
  const documentId = decodeSegment(params.documentId);
  if (documentId === null) {
    return badRequest('Bad request', corsHeaders);
  }

  const db = drizzle(env.DB);
  const doc = await db
    .select({ title: documents.title, content: documents.content })
    .from(documents)
    .where(eq(documents.id, documentId))
    .get();

  if (!doc) {
    return notFound('Document not found', corsHeaders);
  }

  return json(
    { id: documentId, title: doc.title, content: doc.content },
    200,
    { ...corsHeaders, 'cache-control': 'public, max-age=3600' },
  );
}

/**
 * PUT /api/documents/:documentId
 * Protected idempotent document ingest (requires SEED_TOKEN).
 */
export async function handlePutDocument(ctx: RouteContext): Promise<Response> {
  const { request, env, params, corsHeaders } = ctx;

  const token = extractBearerToken(request);
  if (!(await tokensMatch(token, env.SEED_TOKEN))) {
    return unauthorized('Unauthorized', corsHeaders);
  }

  const documentId = decodeSegment(params.documentId);
  if (documentId === null) {
    return badRequest('Bad request', corsHeaders);
  }

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    content?: unknown;
  } | null;

  const title = typeof body?.title === 'string' ? body.title : '';
  const content = typeof body?.content === 'string' ? body.content : '';
  if (!content) {
    return badRequest('Missing content', corsHeaders);
  }

  const createdAt = new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const db = drizzle(env.DB);

  await db
    .insert(documents)
    .values({ id: documentId, title, content, createdAt, updatedAt })
    .onConflictDoUpdate({
      target: documents.id,
      set: { title, content, updatedAt },
    });

  return json({ id: documentId, createdAt, updatedAt }, 200, corsHeaders);
}
