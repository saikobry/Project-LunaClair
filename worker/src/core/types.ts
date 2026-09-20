/**
 * Core types for the LunaClair Cloudflare Worker.
 */

export interface AiBinding {
  run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  /** Cloudflare D1 binding (see wrangler.jsonc -> d1_databases). */
  DB: D1Database;
  /** Comma-separated allowlist of browser origins; empty = local dev defaults. */
  CORS_ORIGINS?: string;
  /** Write-gate secret for the PUT ingest endpoints. Set via .dev.vars / wrangler secret put. */
  SEED_TOKEN?: string;
  /** Cloudflare Workers AI binding for serverless edge inference. */
  AI?: AiBinding;
  /** Override for the UkisAI (Swift) base URL — local dev and tests; unset = hosted endpoint. */
  UKISAI_BASE_URL?: string;
  /**
   * Operational kill switch: comma-separated catalog model ids to stop serving without a deploy.
   * Disabled models drop out of `GET /api/ai/models` and chat refuses them. Applies to every model,
   * including the default (see `resolveDisabledAiModelIds`).
   */
  AI_DISABLED_MODELS?: string;
  /**
   * Global emergency shutdown. Truthy (`true`/`1`/`yes`/`on`) stops the assistant entirely: the
   * catalog reports `availability: 'disabled'` with no models, and chat answers `AI_DISABLED` (503)
   * before it even reads the body. Independent of `AI_DISABLED_MODELS` by design.
   */
  AI_CHAT_DISABLED?: string;
}

export interface RouteContext {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
  corsHeaders: Record<string, string>;
}

export type RouteHandler = (context: RouteContext) => Promise<Response> | Response;
