/**
 * LunaClair API Worker — the only bridge between the LunaClair PWA and Cloudflare D1.
 *
 * Public endpoints (no auth):
 *   GET  /api/documents/:sourceId                       → { id, title, content }
 *   GET  /api/documents/:sourceId/figures/:filename     → figure bytes
 *   GET  /api/catalog                                   → { subjects, terms, subjectTerms, materials }
 *   GET  /api/quiz                                      → { questions, quizzes } (assembled)
 *
 * Ingest endpoints (require `Authorization: Bearer <SEED_TOKEN>`):
 *   PUT  /api/documents/:sourceId                       → body { title, content }
 *   PUT  /api/documents/:sourceId/figures/:filename     → body: raw figure bytes
 *   PUT  /api/catalog                                   → body { subjects, terms, subjectTerms, materials }
 *   PUT  /api/quiz                                      → body { questions, quizzes } (assembled)
 *
 * `/api/catalog` is a **snapshot delivery endpoint**, not a CRUD API — the
 * app hydrates its local database from one snapshot and owns the working copy.
 * `updatedAt`/`createdAt` are always stamped by the server — clients never send timestamps.
 * Path segments are decoded exactly and validated: no `/`, `\`, or `..` in
 * `sourceId`/`filename`, and lookups are always by the composite key, so one
 * document can never reach another document's figure.
 */
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { IndexColumn } from 'drizzle-orm/sqlite-core';
import {
  documents,
  figures,
  materials,
  questions,
  quizQuestions,
  quizzes,
  subjects,
  subjectTerms,
  terms,
} from './schema';

export interface Env {
  /** Cloudflare D1 binding (see wrangler.jsonc → d1_databases). */
  DB: D1Database;
  /** Comma-separated allowlist of browser origins; empty = local dev defaults. */
  CORS_ORIGINS?: string;
  /** Write-gate secret for the PUT ingest endpoints. Set via .dev.vars / `wrangler secret put`. */
  SEED_TOKEN?: string;
}

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

/** Constant-time token comparison (hash both sides, then timing-safe compare). */
async function tokensMatch(a: string | undefined, b: string | undefined): Promise<boolean> {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return ha.byteLength === hb.byteLength && crypto.subtle.timingSafeEqual(ha, hb);
}

function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data);
  if (
    data &&
    typeof data === "object" &&
    "buffer" in data &&
    (data as { buffer: unknown }).buffer instanceof ArrayBuffer
  ) {
    const b = data as { buffer: ArrayBuffer; byteOffset?: number; byteLength?: number };
    return new Uint8Array(b.buffer, b.byteOffset ?? 0, b.byteLength ?? b.buffer.byteLength);
  }
  return new Uint8Array();
}

/** Decode one path segment and reject anything that could traverse or escape. */
function decodeSegment(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  if (decoded.includes("/") || decoded.includes("\\") || decoded === "..") return null;
  return decoded;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    const rawOrigins = env.CORS_ORIGINS?.trim();
    const allowedOrigins = rawOrigins
      ? rawOrigins.split(",").map((o) => o.trim()).filter(Boolean)
      : [];

    const corsOrigin =
      allowedOrigins.length > 0
        ? (origin && allowedOrigins.includes(origin) ? origin : undefined)
        : (origin || "*");

    const corsHeaders: Record<string, string> = {
      "access-control-allow-origin": corsOrigin ?? "*",
      "access-control-allow-methods": "GET, HEAD, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-max-age": "86400",
    };

    // CORS preflight.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Liveness + D1 connectivity probe.
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/health") {
      try {
        await env.DB.prepare("SELECT 1").first();
        return json({ status: "ok", database: "connected" }, 200, corsHeaders);
      } catch {
        return json({ status: "error", database: "unreachable" }, 503, corsHeaders);
      }
    }

    const db = drizzle(env.DB);
    const parts = url.pathname.split("/").filter(Boolean); // e.g. ["api","documents","cell-structure"]

    // /api/documents/:sourceId
    if (parts[0] === "api" && parts[1] === "documents" && parts.length === 3) {
      const sourceId = decodeSegment(parts[2]);
      if (sourceId === null) return json({ error: "Bad request" }, 400, corsHeaders);

      if (request.method === "GET" || request.method === "HEAD") {
        const doc = await db
          .select({ title: documents.title, content: documents.content })
          .from(documents)
          .where(eq(documents.sourceId, sourceId))
          .get();
        if (!doc) return json({ error: "Document not found" }, 404, corsHeaders);
        return json(
          { id: sourceId, title: doc.title, content: doc.content },
          200,
          { ...corsHeaders, "cache-control": "public, max-age=3600" },
        );
      }

      if (request.method === "PUT") {
        if (!(await tokensMatch(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), env.SEED_TOKEN))) {
          return json({ error: "Unauthorized" }, 401, corsHeaders);
        }
        const body = (await request.json().catch(() => null)) as { title?: unknown; content?: unknown } | null;
        const title = typeof body?.title === "string" ? body.title : "";
        const content = typeof body?.content === "string" ? body.content : "";
        if (!content) return json({ error: "Missing content" }, 400, corsHeaders);
        const createdAt = new Date();
        const updatedAt = new Date();
        await db
          .insert(documents)
          .values({ sourceId, title, content, createdAt, updatedAt })
          .onConflictDoUpdate({
            target: documents.sourceId,
            set: { title, content, updatedAt },
          });
        return json({ id: sourceId, createdAt, updatedAt }, 200, corsHeaders);
      }

      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    // /api/documents/:sourceId/figures/:filename
    if (parts[0] === "api" && parts[1] === "documents" && parts.length === 5 && parts[3] === "figures") {
      const sourceId = decodeSegment(parts[2]);
      const filename = decodeSegment(parts[4]);
      if (sourceId === null || filename === null) return json({ error: "Bad request" }, 400, corsHeaders);

      if (request.method === "GET" || request.method === "HEAD") {
        const fig = await db
          .select({ data: figures.data, contentType: figures.contentType })
          .from(figures)
          .where(and(eq(figures.sourceId, sourceId), eq(figures.filename, filename)))
          .get();
        if (!fig) return json({ error: "Figure not found" }, 404, corsHeaders);
        const body = request.method === "HEAD" ? null : (toUint8Array(fig.data) as unknown as BodyInit);
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": fig.contentType,
            "cache-control": "public, max-age=86400",
            ...corsHeaders,
          },
        });
      }

      if (request.method === "PUT") {
        if (!(await tokensMatch(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), env.SEED_TOKEN))) {
          return json({ error: "Unauthorized" }, 401, corsHeaders);
        }
        const data = new Uint8Array(await request.arrayBuffer());
        const contentType = request.headers.get("content-type") || "application/octet-stream";
        const createdAt = new Date();
        const updatedAt = new Date();
        await db
          .insert(figures)
          .values({ sourceId, filename, data: data as unknown as InstanceType<typeof Buffer>, contentType, createdAt, updatedAt })
          .onConflictDoUpdate({
            target: [figures.sourceId, figures.filename],
            set: { data, contentType, updatedAt },
          });
        return json({ sourceId, filename, createdAt, updatedAt }, 200, corsHeaders);
      }

      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    // /api/catalog — snapshot delivery of the library catalog (public GET).
    if (parts[0] === "api" && parts[1] === "catalog" && parts.length === 2) {
      if (request.method === "GET" || request.method === "HEAD") {
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
          { ...corsHeaders, "cache-control": "public, max-age=3600" },
        );
      }

      if (request.method === "PUT") {
        if (!(await tokensMatch(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), env.SEED_TOKEN))) {
          return json({ error: "Unauthorized" }, 401, corsHeaders);
        }
        const body = (await request.json().catch(() => null)) as {
          subjects?: unknown;
          terms?: unknown;
          subjectTerms?: unknown;
          materials?: unknown;
        } | null;
        const now = new Date().toISOString();
        // Apply in dependency order so FKs hold: subjects → terms → subjectTerms → materials.
        const upsert = async (
          rows: unknown[],
          insert: ReturnType<typeof db.insert>,
          target: IndexColumn | IndexColumn[],
        ) => {
          for (const row of rows as Array<Record<string, unknown>>) {
            await insert
              .values({ ...row, createdAt: now, updatedAt: now })
              .onConflictDoUpdate({ target, set: { ...row, updatedAt: now } });
          }
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

      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    // /api/quiz — snapshot delivery of the quiz content (public GET).
    if (parts[0] === "api" && parts[1] === "quiz" && parts.length === 2) {
      if (request.method === "GET" || request.method === "HEAD") {
        const [questionRows, quizRows, junctionRows] = await Promise.all([
          db.select().from(questions).all(),
          db.select().from(quizzes).all(),
          db.select().from(quizQuestions).all(),
        ]);
        // Assemble each quiz's questionIds + items from the junction, ordered.
        const byQuiz = new Map<string, typeof junctionRows>();
        for (const j of junctionRows) {
          const list = byQuiz.get(j.quizId) ?? [];
          list.push(j);
          byQuiz.set(j.quizId, list);
        }
        const assembledQuizzes = quizRows.map((q) => {
          const items = (byQuiz.get(q.id) ?? [])
            .toSorted((a, b) => a.order - b.order)
            .map((j) => ({
              quizId: j.quizId,
              questionId: j.questionId,
              questionVersion: j.questionVersion,
              order: j.order,
              points: j.points ?? undefined,
            }));
          return {
            ...q,
            questionIds: items.map((i) => i.questionId),
            items,
          };
        });
        return json(
          { questions: questionRows, quizzes: assembledQuizzes },
          200,
          { ...corsHeaders, "cache-control": "public, max-age=3600" },
        );
      }

      if (request.method === "PUT") {
        if (!(await tokensMatch(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), env.SEED_TOKEN))) {
          return json({ error: "Unauthorized" }, 401, corsHeaders);
        }
        const body = (await request.json().catch(() => null)) as {
          questions?: unknown;
          quizzes?: unknown;
        } | null;
        const now = new Date().toISOString();
        // Loose-typed upsert helper (same pattern as the catalog route): the
        // concrete table builder rejects spread `Record<string, unknown>` rows.
        const upsertRow = async (
          insert: ReturnType<typeof db.insert>,
          row: Record<string, unknown>,
          target: IndexColumn | IndexColumn[],
        ) => {
          await insert
            .values({ ...row, createdAt: now, updatedAt: now })
            .onConflictDoUpdate({ target, set: { ...row, updatedAt: now } });
        };
        // Apply in FK-safe order: questions → quizzes → junction rows.
        if (Array.isArray(body?.questions)) {
          for (const row of body.questions as Array<Record<string, unknown>>) {
            await upsertRow(db.insert(questions), row, questions.id);
          }
        }
        if (Array.isArray(body?.quizzes)) {
          for (const row of body.quizzes as Array<Record<string, unknown>>) {
            const { questionIds: _questionIds, items, ...quizFields } = row;
            await upsertRow(db.insert(quizzes), quizFields, quizzes.id);
            // Replace the junction rows for this quiz (items are authoritative).
            if (Array.isArray(items)) {
              await db.delete(quizQuestions).where(eq(quizQuestions.quizId, row.id as string));
              for (const item of items as Array<Record<string, unknown>>) {
                await db.insert(quizQuestions).values({
                  quizId: row.id as string,
                  questionId: item.questionId as string,
                  questionVersion: item.questionVersion as number,
                  order: item.order as number,
                  points: (item.points as number | undefined) ?? null,
                });
              }
            }
          }
        }
        return json({ ok: true, updatedAt: now }, 200, corsHeaders);
      }

      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    return json({ error: "Not found" }, 404, corsHeaders);
  },
} satisfies ExportedHandler<Env>;
