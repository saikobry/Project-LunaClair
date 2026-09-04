import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { IndexColumn } from 'drizzle-orm/sqlite-core';
import { decodeSegment } from '../core/path';
import { badRequest, json, notFound, unauthorized } from '../core/responses';
import { extractBearerToken, tokensMatch } from '../core/security';
import type { RouteContext } from '../core/types';
import { materials, subjects, subjectTerms, terms } from '../schema';

/**
 * GET /api/catalog
 * Public snapshot delivery of the entire library catalog, cached for 1 hour.
 */
export async function handleGetCatalog(ctx: RouteContext): Promise<Response> {
  const { env, corsHeaders } = ctx;
  const db = drizzle(env.DB);

  const [subjectsRows, termsRows, subjectTermRows, materialRows] = await Promise.all([
    db.select().from(subjects).all(),
    db.select().from(terms).all(),
    db.select().from(subjectTerms).all(),
    db.select().from(materials).all(),
  ]);

  return json(
    {
      subjects: subjectsRows,
      terms: termsRows,
      subjectTerms: subjectTermRows,
      materials: materialRows,
    },
    200,
    { ...corsHeaders, 'cache-control': 'public, max-age=3600' },
  );
}

/**
 * PUT /api/catalog
 * Protected idempotent bulk catalog upsert (requires SEED_TOKEN).
 * Rows are applied in foreign-key dependency order:
 * subjects -> terms -> subjectTerms -> materials.
 */
export async function handlePutCatalog(ctx: RouteContext): Promise<Response> {
  const { request, env, corsHeaders } = ctx;

  const token = extractBearerToken(request);
  if (!(await tokensMatch(token, env.SEED_TOKEN))) {
    return unauthorized('Unauthorized', corsHeaders);
  }

  const body = (await request.json().catch(() => null)) as {
    subjects?: unknown;
    terms?: unknown;
    subjectTerms?: unknown;
    materials?: unknown;
  } | null;

  const now = new Date().toISOString();
  const db = drizzle(env.DB);

  const upsert = async (
    rows: unknown[],
    insert: ReturnType<typeof db.insert>,
    target: IndexColumn | IndexColumn[],
  ) => {
    await Promise.all(
      (rows as Array<Record<string, unknown>>).map((row) =>
        insert
          .values({ ...row, createdAt: now, updatedAt: now })
          .onConflictDoUpdate({ target, set: { ...row, updatedAt: now } }),
      ),
    );
  };

  if (Array.isArray(body?.subjects)) {
    await upsert(body.subjects, db.insert(subjects), subjects.id);
  }
  if (Array.isArray(body?.terms)) {
    await upsert(body.terms, db.insert(terms), terms.id);
  }
  if (Array.isArray(body?.subjectTerms)) {
    await upsert(body.subjectTerms, db.insert(subjectTerms), [subjectTerms.subjectId, subjectTerms.termId]);
  }
  if (Array.isArray(body?.materials)) {
    await upsert(body.materials, db.insert(materials), materials.id);
  }

  return json({ ok: true, updatedAt: now }, 200, corsHeaders);
}

/**
 * GET /api/catalog/materials/:id
 * Authoritative single-material resolution with relations ({ material, subject?, term?, subjectTerm? }).
 * Uncached (no-store) for direct import resolution.
 */
export async function handleGetCatalogMaterial(ctx: RouteContext): Promise<Response> {
  const { env, params, corsHeaders } = ctx;
  const materialId = decodeSegment(params.id);
  if (materialId === null) {
    return badRequest('Bad request', corsHeaders);
  }

  const db = drizzle(env.DB);
  const material = await db
    .select()
    .from(materials)
    .where(eq(materials.id, materialId))
    .get();

  if (!material) {
    return notFound('Material not found', corsHeaders);
  }

  const [subject, term, subjectTerm] = await Promise.all([
    material.subjectId
      ? db.select().from(subjects).where(eq(subjects.id, material.subjectId)).get()
      : Promise.resolve(undefined),
    material.termId
      ? db.select().from(terms).where(eq(terms.id, material.termId)).get()
      : Promise.resolve(undefined),
    material.subjectId && material.termId
      ? db
          .select()
          .from(subjectTerms)
          .where(
            and(
              eq(subjectTerms.subjectId, material.subjectId),
              eq(subjectTerms.termId, material.termId),
            ),
          )
          .get()
      : Promise.resolve(undefined),
  ]);

  return json(
    {
      material,
      subject: subject ?? undefined,
      term: term ?? undefined,
      subjectTerm: subjectTerm ?? undefined,
    },
    200,
    { ...corsHeaders, 'cache-control': 'no-store' },
  );
}
