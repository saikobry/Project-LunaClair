import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../index';
import { createMockD1 } from './helpers/mockD1';

describe('Worker /api/documents/:documentId/figures/:filename Endpoints', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      DB: createMockD1(),
      SEED_TOKEN: 'correct-seed-token',
      CORS_ORIGINS: 'https://test.lunaclair.app',
    };
  });

  it('returns 404 when figure does not exist', async () => {
    const req = new Request('https://api.test/api/documents/doc-1/figures/diagram.png');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Figure not found' });
  });

  it('returns 400 when documentId or filename contains traversal', async () => {
    const req = new Request('https://api.test/api/documents/doc-1/figures/invalid%2Ftraversal.png');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Bad request' });
  });

  it('uploads a binary figure via PUT and retrieves it via GET with 24-hour cache', async () => {
    // First ingest the parent document (foreign key requirement)
    await worker.fetch(
      new Request('https://api.test/api/documents/doc-1', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer correct-seed-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Parent Doc', content: 'Doc markdown' }),
      }),
      env,
    );

    const fakePngData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);

    // PUT figure
    const putReq = new Request('https://api.test/api/documents/doc-1/figures/diagram.png', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer correct-seed-token',
        'Content-Type': 'image/png',
      },
      body: fakePngData,
    });
    const putRes = await worker.fetch(putReq, env);

    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as { documentId: string; filename: string };
    expect(putBody.documentId).toBe('doc-1');
    expect(putBody.filename).toBe('diagram.png');

    // GET figure
    const getReq = new Request('https://api.test/api/documents/doc-1/figures/diagram.png');
    const getRes = await worker.fetch(getReq, env);

    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('content-type')).toBe('image/png');
    expect(getRes.headers.get('cache-control')).toBe('public, max-age=86400');
    const retrievedBytes = new Uint8Array(await getRes.arrayBuffer());
    expect(retrievedBytes).toEqual(fakePngData);

    // HEAD figure
    const headReq = new Request('https://api.test/api/documents/doc-1/figures/diagram.png', {
      method: 'HEAD',
    });
    const headRes = await worker.fetch(headReq, env);
    expect(headRes.status).toBe(200);
    expect(headRes.headers.get('content-type')).toBe('image/png');
    expect(await headRes.text()).toBe('');
  });

  it('rejects PUT without valid SEED_TOKEN', async () => {
    const putReq = new Request('https://api.test/api/documents/doc-1/figures/diagram.png', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer wrong-token',
        'Content-Type': 'image/png',
      },
      body: new Uint8Array([1, 2, 3]),
    });
    const putRes = await worker.fetch(putReq, env);

    expect(putRes.status).toBe(401);
  });
});
