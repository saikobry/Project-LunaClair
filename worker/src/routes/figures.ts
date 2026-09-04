import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { decodeSegment, toUint8Array } from '../core/path';
import { badRequest, binary, json, notFound, unauthorized } from '../core/responses';
import { extractBearerToken, tokensMatch } from '../core/security';
import type { RouteContext } from '../core/types';
import { figures } from '../schema';

/**
 * GET /api/documents/:documentId/figures/:filename
 * Public figure image fetch (binary bytes + Content-Type), cached for 24 hours.
 */
export async function handleGetFigure(ctx: RouteContext): Promise<Response> {
  const { request, env, params, corsHeaders } = ctx;
  const documentId = decodeSegment(params.documentId);
  const filename = decodeSegment(params.filename);

  if (documentId === null || filename === null) {
    return badRequest('Bad request', corsHeaders);
  }

  const db = drizzle(env.DB);
  const fig = await db
    .select({ data: figures.data, contentType: figures.contentType })
    .from(figures)
    .where(and(eq(figures.documentId, documentId), eq(figures.filename, filename)))
    .get();

  if (!fig) {
    return notFound('Figure not found', corsHeaders);
  }

  const body = request.method === 'HEAD' ? null : (toUint8Array(fig.data) as unknown as BodyInit);
  return binary(body, fig.contentType, {
    'cache-control': 'public, max-age=86400',
    ...corsHeaders,
  });
}

/**
 * PUT /api/documents/:documentId/figures/:filename
 * Protected idempotent figure ingest (requires SEED_TOKEN).
 */
export async function handlePutFigure(ctx: RouteContext): Promise<Response> {
  const { request, env, params, corsHeaders } = ctx;

  const token = extractBearerToken(request);
  if (!(await tokensMatch(token, env.SEED_TOKEN))) {
    return unauthorized('Unauthorized', corsHeaders);
  }

  const documentId = decodeSegment(params.documentId);
  const filename = decodeSegment(params.filename);

  if (documentId === null || filename === null) {
    return badRequest('Bad request', corsHeaders);
  }

  const data = new Uint8Array(await request.arrayBuffer());
  const contentType = request.headers.get('content-type') || 'application/octet-stream';
  const createdAt = new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const db = drizzle(env.DB);

  await db
    .insert(figures)
    .values({
      documentId,
      filename,
      data: data as unknown as InstanceType<typeof Buffer>,
      contentType,
      createdAt,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [figures.documentId, figures.filename],
      set: { data, contentType, updatedAt },
    });

  return json({ documentId, filename, createdAt, updatedAt }, 200, corsHeaders);
}
