/**
 * LunaClair API Worker — the only bridge between the LunaClair PWA and Cloudflare D1.
 * The browser cannot reach D1 directly; all cloud data flows through this Worker.
 * See `wrangler.jsonc` for the D1 binding and `worker/migrations/` for schema.
 */

export interface Env {
  /** Cloudflare D1 binding (see wrangler.jsonc → d1_databases). */
  DB: D1Database;
  /** Optional comma-separated allowlist of origins; defaults to local dev. */
  CORS_ORIGINS?: string;
}

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    const allowedOrigins = (env.CORS_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS.join(","))
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : undefined;
    const corsHeaders: Record<string, string> = corsOrigin
      ? {
          "access-control-allow-origin": corsOrigin,
          "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
          "access-control-allow-headers": "content-type, authorization",
          "access-control-max-age": "86400",
        }
      : {};

    // CORS preflight.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Liveness + D1 connectivity probe.
    if (request.method === "GET" && url.pathname === "/health") {
      try {
        await env.DB.prepare("SELECT 1").first();
        return json({ status: "ok", database: "connected" }, 200, corsHeaders);
      } catch {
        return json({ status: "error", database: "unreachable" }, 503, corsHeaders);
      }
    }

    return json({ error: "Not found" }, 404, corsHeaders);
  },
} satisfies ExportedHandler<Env>;
