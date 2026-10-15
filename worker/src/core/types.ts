/**
 * Core types for the LunaClair Cloudflare Worker.
 */

export interface AiBinding {
  run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  /** Cloudflare D1 binding (see worker/cloudflare.config.ts). */
  DB: D1Database;
  /** Comma-separated allowlist of browser origins; empty = local dev defaults. */
  CORS_ORIGINS?: string;
  /** Write-gate secret for the PUT ingest endpoints. Set via .dev.vars / cf secrets. */
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
  /** Google OAuth Client ID for token exchange. */
  GOOGLE_CLIENT_ID?: string;
  /** Google OAuth Client Secret for token exchange. Set via .dev.vars / cf secrets. */
  GOOGLE_CLIENT_SECRET?: string;
  /** 256-bit hex master key for AES-256-GCM token sealing. Set via .dev.vars / cf secrets. */
  AUTH_MASTER_KEY?: string;
}

export interface RouteContext {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
  corsHeaders: Record<string, string>;
}

export type RouteHandler = (context: RouteContext) => Promise<Response> | Response;
