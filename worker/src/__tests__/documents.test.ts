import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../index';
import { createMockD1 } from './helpers/mockD1';

describe('Worker /api/documents/:documentId Endpoints', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      DB: createMockD1(),
      SEED_TOKEN: 'correct-seed-token',
      CORS_ORIGINS: 'https://test.lunaclair.app',
    };
  });

  describe('GET /api/documents/:documentId', () => {
    it('returns 404 when document does not exist', async () => {
      const req = new Request('https://api.test/api/documents/non-existent-doc');
      const res = await worker.fetch(req, env);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Document not found' });
    });

    it('returns 400 when documentId contains invalid traversal characters', async () => {
      const req = new Request('https://api.test/api/documents/invalid%2Ftraversal');
      const res = await worker.fetch(req, env);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Bad request' });
    });

    it('returns 200 with document and 1-hour public cache headers', async () => {
      // First ingest a document via PUT
      const putReq = new Request('https://api.test/api/documents/cell-bio', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer correct-seed-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Cellular Biology',
          content: '# Cells\nAll living organisms are composed of cells.',
        }),
      });
      const putRes = await worker.fetch(putReq, env);
      expect(putRes.status).toBe(200);

      // Now fetch it
      const getReq = new Request('https://api.test/api/documents/cell-bio');
      const getRes = await worker.fetch(getReq, env);

      expect(getRes.status).toBe(200);
      expect(getRes.headers.get('cache-control')).toBe('public, max-age=3600');
      const data = (await getRes.json()) as { id: string; title: string; content: string };
      expect(data.id).toBe('cell-bio');
      expect(data.title).toBe('Cellular Biology');
      expect(data.content).toContain('All living organisms');
    });
  });

  describe('PUT /api/documents/:documentId', () => {
    it('returns 401 when Authorization header is missing or incorrect', async () => {
      const req = new Request('https://api.test/api/documents/cell-bio', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer wrong-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Test', content: 'Content' }),
      });
      const res = await worker.fetch(req, env);

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Unauthorized' });
    });

    it('returns 400 when content is missing', async () => {
      const req = new Request('https://api.test/api/documents/cell-bio', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer correct-seed-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'No Content' }),
      });
      const res = await worker.fetch(req, env);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Missing content' });
    });

    it('idempotently updates existing document', async () => {
      const firstPut = new Request('https://api.test/api/documents/cell-bio', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer correct-seed-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Initial', content: 'Initial content' }),
      });
      const res1 = await worker.fetch(firstPut, env);
      expect(res1.status).toBe(200);

      const secondPut = new Request('https://api.test/api/documents/cell-bio', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer correct-seed-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Updated', content: 'Updated content' }),
      });
      const res2 = await worker.fetch(secondPut, env);
      expect(res2.status).toBe(200);

      const getReq = new Request('https://api.test/api/documents/cell-bio');
      const getRes = await worker.fetch(getReq, env);
      const data = (await getRes.json()) as { title: string; content: string };
      expect(data.title).toBe('Updated');
      expect(data.content).toBe('Updated content');
    });
  });

  describe('Method Not Allowed', () => {
    it('returns 405 for DELETE /api/documents/:documentId', async () => {
      const req = new Request('https://api.test/api/documents/cell-bio', {
        method: 'DELETE',
      });
      const res = await worker.fetch(req, env);

      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toContain('GET');
      expect(res.headers.get('allow')).toContain('PUT');
    });
  });
});
