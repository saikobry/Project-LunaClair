import type { Env } from './types';

/**
 * Computes standard CORS headers reflecting the requesting origin when permitted by CORS_ORIGINS.
 */
export function computeCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const rawOrigins = env.CORS_ORIGINS?.trim();
  const allowedOrigins = rawOrigins
    ? rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const corsOrigin =
    allowedOrigins.length > 0
      ? origin && allowedOrigins.includes(origin)
        ? origin
        : undefined
      : origin || '*';

  return {
    'access-control-allow-origin': corsOrigin ?? '*',
    'access-control-allow-methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, x-user-id, x-share-passcode',
    'access-control-max-age': '86400',
  };
}

/**
 * Handles HTTP OPTIONS CORS preflight requests.
 * Returns a 204 No Content response with CORS headers if OPTIONS, or null otherwise.
 */
export function handleCorsPreflight(request: Request, env: Env): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: computeCorsHeaders(request, env),
    });
  }
  return null;
}
