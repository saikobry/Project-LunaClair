import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../index';
import { createMockD1 } from './helpers/mockD1';

describe('Worker Sync Routes Purged (D1 Sync Decommissioning)', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      DB: createMockD1(),
      CORS_ORIGINS: 'https://test.lunaclair.app',
      SEED_TOKEN: 'test-seed-token',
    };
  });

  it('POST /api/sync/push returns 404 Not Found with JSON error payload', async () => {
    const req = new Request('https://api.test/api/sync/push', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        deviceId: 'dev-1',
        mutations: [],
      }),
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Not found' });
  });

  it('GET /api/sync/pull returns 404 Not Found with JSON error payload', async () => {
    const req = new Request('https://api.test/api/sync/pull?cursor=0&limit=50', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Not found' });
  });

  it('HEAD /api/sync/pull returns 404 Not Found', async () => {
    const req = new Request('https://api.test/api/sync/pull', {
      method: 'HEAD',
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(404);
  });
});
