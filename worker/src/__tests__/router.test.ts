import { describe, expect, it } from 'vitest';
import { json } from '../core/responses';
import type { Env, RouteContext } from '../core/types';
import worker from '../index';
import { Router } from '../router';
import { createMockD1 } from './helpers/mockD1';

describe('Zero-Framework Router Unit & Architectural Tests', () => {
  const dummyEnv: Env = {
    DB: createMockD1(),
    CORS_ORIGINS: '*',
  };

  it('routes to registered handler and extracts path parameters', async () => {
    const router = new Router();
    router.register('GET', '/users/:userId/books/:bookId', (ctx: RouteContext) => {
      return json({
        userId: ctx.params.userId,
        bookId: ctx.params.bookId,
      });
    });

    const req = new Request('https://api.test/users/u-123/books/b-456');
    const res = await router.handle(req, dummyEnv, {});

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'u-123', bookId: 'b-456' });
  });

  it('prefers static path over parameterized path when registered', async () => {
    const router = new Router();
    // Register parameter path first
    router.register('GET', '/items/:id', () => json({ type: 'parameter' }));
    // Register static path second
    router.register('GET', '/items/featured', () => json({ type: 'static' }));

    const req = new Request('https://api.test/items/featured');
    const res = await router.handle(req, dummyEnv, {});

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 'static' });
  });

  it('returns 404 when no route matches the path', async () => {
    const req = new Request('https://api.test/non-existent-endpoint');
    const res = await worker.fetch(req, dummyEnv);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('returns 405 with Allow header when path matches but method does not', async () => {
    const router = new Router();
    router.register(['GET', 'PUT'], '/test-endpoint', () => json({ ok: true }));

    const req = new Request('https://api.test/test-endpoint', { method: 'DELETE' });
    const res = await router.handle(req, dummyEnv, {});

    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toContain('GET');
    expect(res.headers.get('allow')).toContain('PUT');
    expect(await res.json()).toEqual({ error: 'Method not allowed' });
  });

  it('catches unhandled exceptions in the composition root and returns 500', async () => {
    // Force an unexpected error by passing an env that throws unexpectedly during route dispatch
    const crashingEnv: Env = {
      DB: {
        prepare() {
          throw new Error('Fatal unexpected database crash');
        },
      } as unknown as D1Database,
    };

    // Access an endpoint that performs DB operations without its own internal catch (e.g. documents)
    const req = new Request('https://api.test/api/documents/some-doc');
    const res = await worker.fetch(req, crashingEnv);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
  });
});
