import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../index';
import { createMockD1 } from './helpers/mockD1';

describe('Worker /api/catalog Endpoints', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      DB: createMockD1(),
      SEED_TOKEN: 'correct-seed-token',
      CORS_ORIGINS: 'https://test.lunaclair.app',
    };
  });

  const sampleCatalog = {
    subjects: [
      { id: 'subj-bio', title: 'Biology', description: 'Life science', order: 1 },
    ],
    terms: [
      { id: 'term-prelim', title: 'Prelims' },
    ],
    subjectTerms: [
      { subjectId: 'subj-bio', termId: 'term-prelim', order: 1 },
    ],
    materials: [
      {
        id: 'mat-cell-bio',
        title: 'Cellular Biology',
        description: 'Introduction to cells',
        documentId: 'doc-cells',
        subjectId: 'subj-bio',
        termId: 'term-prelim',
        order: 1,
      },
    ],
  };

  it('rejects PUT /api/catalog without valid SEED_TOKEN', async () => {
    const req = new Request('https://api.test/api/catalog', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer bad-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleCatalog),
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
  });

  it('upserts entire catalog via PUT /api/catalog and serves via GET /api/catalog', async () => {
    // 1. PUT catalog
    const putReq = new Request('https://api.test/api/catalog', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer correct-seed-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleCatalog),
    });
    const putRes = await worker.fetch(putReq, env);

    expect(putRes.status).toBe(200);
    expect(await putRes.json()).toEqual(
      expect.objectContaining({ ok: true, updatedAt: expect.any(String) }),
    );

    // 2. GET catalog
    const getReq = new Request('https://api.test/api/catalog');
    const getRes = await worker.fetch(getReq, env);

    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('cache-control')).toBe('public, max-age=3600');
    const data = (await getRes.json()) as typeof sampleCatalog;
    expect(data.subjects).toHaveLength(1);
    expect(data.subjects[0].id).toBe('subj-bio');
    expect(data.terms).toHaveLength(1);
    expect(data.terms[0].id).toBe('term-prelim');
    expect(data.materials).toHaveLength(1);
    expect(data.materials[0].id).toBe('mat-cell-bio');
  });

  it('resolves authoritative single material via GET /api/catalog/materials/:id with no-store', async () => {
    // Seed catalog
    await worker.fetch(
      new Request('https://api.test/api/catalog', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer correct-seed-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sampleCatalog),
      }),
      env,
    );

    // Fetch existing material
    const res = await worker.fetch(
      new Request('https://api.test/api/catalog/materials/mat-cell-bio'),
      env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as {
      material: { id: string; title: string };
      subject?: { id: string; title: string };
      term?: { id: string; title: string };
      subjectTerm?: { subjectId: string; termId: string };
    };
    expect(body.material.id).toBe('mat-cell-bio');
    expect(body.subject?.id).toBe('subj-bio');
    expect(body.term?.id).toBe('term-prelim');
    expect(body.subjectTerm?.subjectId).toBe('subj-bio');
  });

  it('returns 404 for unknown material in GET /api/catalog/materials/:id', async () => {
    const res = await worker.fetch(
      new Request('https://api.test/api/catalog/materials/unknown-mat'),
      env,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Material not found' });
  });

  it('returns 400 for path traversal in GET /api/catalog/materials/:id', async () => {
    const res = await worker.fetch(
      new Request('https://api.test/api/catalog/materials/invalid%2Ftraversal'),
      env,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Bad request' });
  });
});
