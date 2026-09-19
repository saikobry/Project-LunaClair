import { methodNotAllowed, notFound } from './core/responses';
import type { Env, RouteContext, RouteHandler } from './core/types';
import { handleAiChat, handleAiModels } from './routes/ai';
import { handleHealth } from './routes/health';
import {
  handleCreateShare,
  handleDeleteShare,
  handleGetShare,
  handleListPublicShares,
  handleTrackShareDownload,
} from './routes/shares';
import { handleSyncPull, handleSyncPush } from './routes/sync';

interface Segment {
  isParam: boolean;
  name: string;
}

interface RouteEntry {
  methods: string[];
  pattern: string;
  segments: Segment[];
  score: number;
  handler: RouteHandler;
}

function parsePattern(pattern: string): { segments: Segment[]; score: number } {
  const parts = pattern.split('/').filter(Boolean);
  let score = 0;
  const segments: Segment[] = parts.map((part, index) => {
    const isParam = part.startsWith(':');
    const name = isParam ? part.slice(1) : part;
    // Higher score for static segments than parameter segments
    const weight = isParam ? 1 : 2;
    score += weight * Math.pow(10, Math.max(0, 5 - index));
    return { isParam, name };
  });
  return { segments, score };
}

export class Router {
  private routes: RouteEntry[] = [];

  /**
   * Registers a route mapping HTTP methods and path pattern to a handler.
   */
  public register(
    methods: string | string[],
    pattern: string,
    handler: RouteHandler,
  ): this {
    const methodList = (Array.isArray(methods) ? methods : [methods]).map((m) =>
      m.toUpperCase(),
    );

    // If GET is supported, automatically support HEAD
    if (methodList.includes('GET') && !methodList.includes('HEAD')) {
      methodList.push('HEAD');
    }

    const { segments, score } = parsePattern(pattern);

    this.routes.push({
      methods: methodList,
      pattern,
      segments,
      score,
      handler,
    });

    // Sort routes by score descending so static routes take precedence over params
    this.routes.sort((a, b) => b.score - a.score);

    return this;
  }

  /**
   * Dispatches incoming Request to the matching route handler.
   */
  public async handle(
    request: Request,
    env: Env,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const requestMethod = request.method.toUpperCase();

    // 1. Find all routes matching the path pattern
    const matchingPathRoutes: Array<{
      entry: RouteEntry;
      params: Record<string, string>;
    }> = [];

    for (const entry of this.routes) {
      if (entry.segments.length !== pathSegments.length) {
        continue;
      }

      let matches = true;
      const params: Record<string, string> = {};

      for (let i = 0; i < entry.segments.length; i++) {
        const seg = entry.segments[i];
        const actual = pathSegments[i];

        if (seg.isParam) {
          params[seg.name] = actual;
        } else if (seg.name !== actual) {
          matches = false;
          break;
        }
      }

      if (matches) {
        matchingPathRoutes.push({ entry, params });
      }
    }

    // 2. Unmatched path -> 404 Not Found
    if (matchingPathRoutes.length === 0) {
      return notFound('Not found', corsHeaders);
    }

    // 3. Match against HTTP method
    const matched = matchingPathRoutes.find((m) =>
      m.entry.methods.includes(requestMethod),
    );

    if (matched) {
      const context: RouteContext = {
        request,
        env,
        url,
        params: matched.params,
        corsHeaders,
      };
      return await matched.entry.handler(context);
    }

    // 4. Path exists but method is not allowed -> 405 Method Not Allowed
    const allowedMethods = Array.from(
      new Set(matchingPathRoutes.flatMap((m) => m.entry.methods)),
    );

    return methodNotAllowed(corsHeaders, allowedMethods);
  }
}

/**
 * Creates and initializes the application router with all standard LunaClair routes.
 */
export function createRouter(): Router {
  const router = new Router();

  // Health check
  router.register(['GET', 'HEAD'], '/health', handleHealth);

  // AI model catalog + streaming completions
  router.register(['GET', 'HEAD'], '/api/ai/models', handleAiModels);
  router.register('POST', '/api/ai/chat', handleAiChat);

  // Sync protocol
  router.register('POST', '/api/sync/push', handleSyncPush);
  router.register(['GET', 'HEAD'], '/api/sync/pull', handleSyncPull);

  // Cloud sharing
  router.register(['GET', 'HEAD'], '/api/shares', handleListPublicShares);
  router.register('POST', '/api/shares', handleCreateShare);
  router.register(
    'POST',
    '/api/shares/:id/download',
    handleTrackShareDownload,
  );
  router.register(['GET', 'HEAD'], '/api/shares/:id', handleGetShare);
  router.register('DELETE', '/api/shares/:id', handleDeleteShare);

  return router;
}
