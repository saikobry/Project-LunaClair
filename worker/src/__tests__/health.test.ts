import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../index';
import { createMockD1 } from './helpers/mockD1';

describe('Worker /health Probe', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      DB: createMockD1(),
      CORS_ORIGINS: 'https://test.lunaclair.app',
      SEED_TOKEN: 'test-seed-token',
    };
  });

  it('returns 200 and connected status when D1 responds', async () => {
    const req = new Request('https://api.test/health', { method: 'GET' });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok', database: 'connected' });
  });

  it('supports HEAD method', async () => {
    const req = new Request('https://api.test/health', { method: 'HEAD' });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
  });

  it('returns 503 when D1 is unreachable or throws', async () => {
    env.DB = {
      prepare() {
        throw new Error('Database connection failed');
      },
    } as unknown as D1Database;

    const req = new Request('https://api.test/health', { method: 'GET' });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'error', database: 'unreachable' });
  });

  it('returns 405 Method Not Allowed for disallowed methods', async () => {
    const req = new Request('https://api.test/health', { method: 'POST' });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toContain('GET');
    expect(await res.json()).toEqual({ error: 'Method not allowed' });
  });

  it('handles CORS preflight on /health', async () => {
    const req = new Request('https://api.test/health', {
      method: 'OPTIONS',
      headers: { Origin: 'https://test.lunaclair.app' },
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://test.lunaclair.app');
  });
});
