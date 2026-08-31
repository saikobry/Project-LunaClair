/**
 * LunaClair API Worker — the only bridge between the LunaClair PWA and Cloudflare D1.
 *
 * Public endpoints (no auth):
 *   GET  /api/documents/:documentId                     → { id, title, content }
 *   GET  /api/documents/:documentId/figures/:filename   → figure bytes
 *   GET  /api/catalog                                   → { subjects, terms, subjectTerms, materials }
 *   GET  /api/catalog/materials/:id                     → { material, subject?, term?, subjectTerm? }
 *   GET  /api/quiz                                      → { questions, quizzes } (assembled)
 *
 * Ingest endpoints (require `Authorization: Bearer <SEED_TOKEN>`):
 *   PUT  /api/documents/:documentId                     → body { title, content }
 *   PUT  /api/documents/:documentId/figures/:filename   → body: raw figure bytes
 *   PUT  /api/catalog                                   → body { subjects, terms, subjectTerms, materials }
 *   PUT  /api/quiz                                      → body { questions, quizzes } (assembled)
 *
 * `/api/catalog` is a **snapshot delivery endpoint**, not a CRUD API — the
 * app surfaces it as Available Materials and imports individual materials on
 * user action; no per-row write path.
 * `/api/catalog/materials/:id` is the **authoritative per-material resolution**
 * used by import (uncached `no-store`): import must never depend on the full
 * snapshot being present in memory, and must resolve against current server
 * state — never the 30-day-cached snapshot.
 * `updatedAt`/`createdAt` are always stamped by the server — clients never send timestamps.
 * Path segments are decoded exactly and validated: no `/`, `\`, or `..` in
 * `documentId`/`filename`, and lookups are always by the composite key, so one
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
import { handleSyncPull, handleSyncPush } from './sync';
import {
  handleCreateShare,
  handleDeleteShare,
  handleGetShare,
  handleListPublicShares,
  handleTrackShareDownload,
} from './shares';

export interface AiBinding {
  run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  /** Cloudflare D1 binding (see wrangler.jsonc → d1_databases). */
  DB: D1Database;
  /** Comma-separated allowlist of browser origins; empty = local dev defaults. */
  CORS_ORIGINS?: string;
  /** Write-gate secret for the PUT ingest endpoints. Set via .dev.vars / `wrangler secret put`. */
  SEED_TOKEN?: string;
  /** Cloudflare Workers AI binding for serverless edge inference. */
  AI?: AiBinding;
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

    // /api/documents/:documentId
    if (parts[0] === "api" && parts[1] === "documents" && parts.length === 3) {
      const documentId = decodeSegment(parts[2]);
      if (documentId === null) return json({ error: "Bad request" }, 400, corsHeaders);

      if (request.method === "GET" || request.method === "HEAD") {
        const doc = await db
          .select({ title: documents.title, content: documents.content })
          .from(documents)
          .where(eq(documents.id, documentId))
          .get();
        if (!doc) return json({ error: "Document not found" }, 404, corsHeaders);
        return json(
          { id: documentId, title: doc.title, content: doc.content },
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
        const createdAt = new Date().toISOString();
        const updatedAt = new Date().toISOString();
        await db
          .insert(documents)
          .values({ id: documentId, title, content, createdAt, updatedAt })
          .onConflictDoUpdate({
            target: documents.id,
            set: { title, content, updatedAt },
          });
        return json({ id: documentId, createdAt, updatedAt }, 200, corsHeaders);
      }

      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    // /api/documents/:documentId/figures/:filename
    if (parts[0] === "api" && parts[1] === "documents" && parts.length === 5 && parts[3] === "figures") {
      const documentId = decodeSegment(parts[2]);
      const filename = decodeSegment(parts[4]);
      if (documentId === null || filename === null) return json({ error: "Bad request" }, 400, corsHeaders);

      if (request.method === "GET" || request.method === "HEAD") {
        const fig = await db
          .select({ data: figures.data, contentType: figures.contentType })
          .from(figures)
          .where(and(eq(figures.documentId, documentId), eq(figures.filename, filename)))
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
        const createdAt = new Date().toISOString();
        const updatedAt = new Date().toISOString();
        await db
          .insert(figures)
          .values({ documentId, filename, data: data as unknown as InstanceType<typeof Buffer>, contentType, createdAt, updatedAt })
          .onConflictDoUpdate({
            target: [figures.documentId, figures.filename],
            set: { data, contentType, updatedAt },
          });
        return json({ documentId, filename, createdAt, updatedAt }, 200, corsHeaders);
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
        // Rows WITHIN one table are independent (distinct primary keys), so they are
        // upserted concurrently — the table-level order above still holds. Drizzle's
        // `.values()` returns a fresh builder each call, so the shared `insert` is safe.
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

      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    // /api/catalog/materials/:id — authoritative resolution of ONE material plus
    // the relationships ImportMaterialUseCase needs ({ material, subject?, term?,
    // subjectTerm? }). Uncached (`no-store`): imports must resolve against current
    // server state, never the 30-day-cached snapshot.
    if (
      parts[0] === "api" &&
      parts[1] === "catalog" &&
      parts[2] === "materials" &&
      parts.length === 4
    ) {
      if (request.method === "GET" || request.method === "HEAD") {
        const materialId = decodeSegment(parts[3]);
        if (materialId === null) return json({ error: "Bad request" }, 400, corsHeaders);

        const material = await db
          .select()
          .from(materials)
          .where(eq(materials.id, materialId))
          .get();
        if (!material) return json({ error: "Material not found" }, 404, corsHeaders);

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
          { ...corsHeaders, "cache-control": "no-store" },
        );
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
        // Rows/quizzes are independent of each other (distinct keys), so they run
        // concurrently; within one quiz the delete must finish before its inserts
        // (same composite-key space), so that ordering is preserved.
        if (Array.isArray(body?.questions)) {
          await Promise.all(
            (body.questions as Array<Record<string, unknown>>).map((row) =>
              upsertRow(db.insert(questions), row, questions.id),
            ),
          );
        }
        if (Array.isArray(body?.quizzes)) {
          await Promise.all(
            (body.quizzes as Array<Record<string, unknown>>).map(async (row) => {
              const { questionIds: _questionIds, items, ...quizFields } = row;
              await upsertRow(db.insert(quizzes), quizFields, quizzes.id);
              // Replace the junction rows for this quiz (items are authoritative).
              if (Array.isArray(items)) {
                await db.delete(quizQuestions).where(eq(quizQuestions.quizId, row.id as string));
                await Promise.all(
                  (items as Array<Record<string, unknown>>).map((item) =>
                    db.insert(quizQuestions).values({
                      quizId: row.id as string,
                      questionId: item.questionId as string,
                      questionVersion: item.questionVersion as number,
                      order: item.order as number,
                      points: (item.points as number | undefined) ?? null,
                    }),
                  ),
                );
              }
            }),
          );
        }
        return json({ ok: true, updatedAt: now }, 200, corsHeaders);
      }

      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    // /api/ai/chat — Streaming chat completions with Cloudflare Workers AI
    if (parts[0] === "api" && parts[1] === "ai" && parts[2] === "chat" && parts.length === 3) {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, 405, corsHeaders);
      }

      if (!env.AI) {
        return json({ error: "Cloudflare Workers AI binding not configured on Worker" }, 503, corsHeaders);
      }

      const body = (await request.json().catch(() => null)) as {
        messages?: Array<{ role?: unknown; content?: unknown }>;
        documentContext?: { id?: unknown; title?: unknown; markdown?: unknown };
        selection?: { text?: unknown; surroundingHeading?: unknown; source?: unknown };
        mode?: unknown;
      } | null;

      if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
        return json({ error: "Invalid request: messages array is required" }, 400, corsHeaders);
      }

      const mode = typeof body.mode === "string" ? body.mode : "assistant";
      const docContext = body.documentContext && typeof body.documentContext.markdown === "string"
        ? {
            title: typeof body.documentContext.title === "string" ? body.documentContext.title : "",
            markdown: body.documentContext.markdown,
          }
        : undefined;
      const selection = body.selection && typeof body.selection.text === "string"
        ? {
            text: body.selection.text,
            surroundingHeading: typeof body.selection.surroundingHeading === "string" ? body.selection.surroundingHeading : undefined,
          }
        : undefined;

      // Server-side ground-truth system prompt construction
      let systemPrompt = "You are an intelligent study assistant for Project LunaClair, an interactive learning platform. ";
      switch (mode) {
        case "socratic":
          systemPrompt += "You are in SOCRATIC TUTOR mode. Do not give the direct answer away immediately. Ask guiding questions, break complex problems into steps, and encourage the student to think critically.";
          break;
        case "explain":
          systemPrompt += "You are in EXPLAIN mode. Provide a clear, structured, and thorough explanation of the concept or selected text.";
          break;
        case "simplify":
          systemPrompt += "You are in SIMPLIFY mode. Explain the concept in simple, accessible terms using an intuitive real-world analogy suitable for a beginner.";
          break;
        case "example":
          systemPrompt += "You are in EXAMPLE mode. Provide concrete, illustrative, and memorable examples demonstrating the concept in action.";
          break;
        case "assistant":
        default:
          systemPrompt += "You are in STUDY ASSISTANT mode. Answer the student's questions accurately, concisely, and helpfully.";
          break;
      }

      if (docContext?.markdown) {
        systemPrompt += `\n\n--- STUDY MATERIAL: ${docContext.title || "Current Document"} ---\n${docContext.markdown.slice(0, 16000)}\n--- END OF STUDY MATERIAL ---`;
        systemPrompt += "\n\nGround your answers in the provided study material whenever relevant. If the material does not contain the answer, use your general knowledge but clearly indicate that it is beyond the material.";
      }

      if (selection?.text) {
        systemPrompt += `\n\n--- SELECTED TEXT ---\n"${selection.text}"\n--- END OF SELECTED TEXT ---`;
        if (selection.surroundingHeading) {
          systemPrompt += ` (From section: ${selection.surroundingHeading})`;
        }
      }

      const clientSystemMsgs = body.messages
        .flatMap((m) =>
          m.role === 'system' && typeof m.content === 'string' && m.content.trim()
            ? [m.content.trim()]
            : []
        )
        .join('\n\n');

      const effectiveSystemPrompt = clientSystemMsgs
        ? `${systemPrompt}\n\n--- TASK SPECIFIC INSTRUCTIONS ---\n${clientSystemMsgs}`
        : systemPrompt;

      const formattedMessages: Array<{ role: string; content: string }> = [
        { role: "system", content: effectiveSystemPrompt },
      ];

      for (const m of body.messages) {
        if (m && typeof m.content === "string" && m.role !== "system") {
          const role = m.role === "assistant" ? "assistant" : "user";
          const lastMsg = formattedMessages[formattedMessages.length - 1];
          if (lastMsg && lastMsg.role === role) {
            lastMsg.content += `\n\n${m.content}`;
          } else {
            formattedMessages.push({ role, content: m.content });
          }
        }
      }

      const PRIMARY_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
      const FALLBACK_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
      const messageId = `msg-${crypto.randomUUID()}`;

      try {
        let aiResponse: unknown;
        try {
          aiResponse = await env.AI.run(PRIMARY_AI_MODEL as any, {
            messages: formattedMessages,
            stream: true,
            max_tokens: 4096,
            temperature: 0.5,
          });
        } catch (primaryErr) {
          console.warn("Primary AI model encountered error, falling back to Llama 3.1 8B:", primaryErr);
          aiResponse = await env.AI.run(FALLBACK_AI_MODEL as any, {
            messages: formattedMessages,
            stream: true,
            max_tokens: 4096,
            temperature: 0.5,
          });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let buffer = "";

        // Convert Cloudflare AI stream to LunaClair SSE events with proper line buffering
        const transformStream = new TransformStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start", messageId })}\n\n`));
          },
          transform(chunk, controller) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split("\n");
            // Keep the last incomplete fragment in the buffer
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload) as { response?: string };
                if (typeof parsed.response === "string" && parsed.response.length > 0) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "token", text: parsed.response })}\n\n`),
                  );
                }
              } catch {
                // Ignore incomplete line or malformed payload
              }
            }
          },
          flush(controller) {
            if (buffer.trim()) {
              const trimmed = buffer.trim();
              if (trimmed.startsWith("data:")) {
                const payload = trimmed.slice(5).trim();
                if (payload !== "[DONE]") {
                  try {
                    const parsed = JSON.parse(payload) as { response?: string };
                    if (typeof parsed.response === "string" && parsed.response.length > 0) {
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: "token", text: parsed.response })}\n\n`),
                      );
                    }
                  } catch {
                    // Ignore
                  }
                }
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          },
        });

        const outputStream = (aiResponse as ReadableStream<Uint8Array>).pipeThrough(transformStream);

        return new Response(outputStream, {
          status: 200,
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            "connection": "keep-alive",
            ...corsHeaders,
          },
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "AI stream invocation failed";
        return json({ error: errorMsg }, 500, corsHeaders);
      }
    }

    // /api/sync/push — Push mutation envelopes for cloud sync
    if (parts[0] === "api" && parts[1] === "sync" && parts[2] === "push" && parts.length === 3) {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, 405, corsHeaders);
      }
      return handleSyncPush(request, env, corsHeaders);
    }

    // /api/sync/pull — Pull delta changes by sequence cursor
    if (parts[0] === "api" && parts[1] === "sync" && parts[2] === "pull" && parts.length === 3) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "Method not allowed" }, 405, corsHeaders);
      }
      return handleSyncPull(request, env, corsHeaders);
    }

    // /api/shares — Discovery feed (GET) or Publish a new StudyPackage share snapshot (POST)
    if (parts[0] === "api" && parts[1] === "shares" && parts.length === 2) {
      if (request.method === "GET" || request.method === "HEAD") {
        return handleListPublicShares(request, env, url, corsHeaders);
      }
      if (request.method === "POST") {
        return handleCreateShare(request, env, corsHeaders);
      }
      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    // /api/shares/:id/download — Track a download
    if (parts[0] === "api" && parts[1] === "shares" && parts.length === 4 && parts[3] === "download") {
      const shareId = parts[2];
      if (request.method === "POST") {
        return handleTrackShareDownload(env, shareId, corsHeaders);
      }
      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    // /api/shares/:id — Retrieve or delete a published share
    if (parts[0] === "api" && parts[1] === "shares" && parts.length === 3) {
      const shareId = parts[2];
      if (request.method === "GET" || request.method === "HEAD") {
        return handleGetShare(request, env, shareId, url, corsHeaders);
      }
      if (request.method === "DELETE") {
        return handleDeleteShare(request, env, shareId, corsHeaders);
      }
      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    return json({ error: "Not found" }, 404, corsHeaders);
  },
} satisfies ExportedHandler<Env>;
