/**
 * LunaClair API Worker — Bridge between LunaClair PWA and Cloudflare D1.
 * Composition root orchestrating CORS, route dispatching, and error boundary.
 */
import { computeCorsHeaders, handleCorsPreflight } from './core/cors';
import { serverError } from './core/responses';
import type { Env } from './core/types';
import { createRouter } from './router';

export type { AiBinding, Env, RouteContext, RouteHandler } from './core/types';

const router = createRouter();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const preflight = handleCorsPreflight(request, env);
    if (preflight) return preflight;

    const corsHeaders = computeCorsHeaders(request, env);

    try {
      return await router.handle(request, env, corsHeaders);
    } catch (err: unknown) {
      console.error('Unhandled worker exception:', err);
      return serverError('Internal server error', corsHeaders);
    }
  },
} satisfies ExportedHandler<Env>;
