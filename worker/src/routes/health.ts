import { json } from '../core/responses';
import type { RouteContext } from '../core/types';

/**
 * GET /health — Liveness + D1 connectivity probe.
 * Returns 200 when D1 is reachable, 503 when D1 fails.
 */
export async function handleHealth(ctx: RouteContext): Promise<Response> {
  const { env, corsHeaders } = ctx;
  try {
    await env.DB.prepare('SELECT 1').first();
    return json({ status: 'ok', database: 'connected' }, 200, corsHeaders);
  } catch {
    return json({ status: 'error', database: 'unreachable' }, 503, corsHeaders);
  }
}
