/**
 * Integration Tests for Cloud Sharing Service (POST /api/shares, GET /api/shares/:id, DELETE /api/shares/:id)
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../index';
import type { PublishedShareResponse, PublishShareResponse } from '../shares';

function createMockD1(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      id text PRIMARY KEY,
      format text DEFAULT 'lcpack' NOT NULL,
      schema_version integer DEFAULT 1 NOT NULL,
      title text NOT NULL,
      description text,
      author text,
      access_type text DEFAULT 'public' NOT NULL,
      passcode_hash text,
      package_payload text NOT NULL,
      user_id text,
      view_count integer DEFAULT 0 NOT NULL,
      download_count integer DEFAULT 0 NOT NULL,
      expires_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );
  `);

  class MockD1PreparedStatement implements D1PreparedStatement {
    private query: string;
    private params: unknown[];

    constructor(query: string, params: unknown[] = []) {
      this.query = query;
      this.params = params;
    }

    bind(...values: unknown[]): D1PreparedStatement {
      return new MockD1PreparedStatement(this.query, values);
    }

    async first<T = unknown>(colName?: string): Promise<T | null> {
      const stmt = db.prepare(this.query);
      const row = (stmt.get as any)(...this.params) as Record<string, unknown> | undefined;
      if (!row) return null;
      if (colName) return (row[colName] as T) ?? null;
      return row as T;
    }

    async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      const stmt = db.prepare(this.query);
      const results = (stmt.all as any)(...this.params) as T[];
      return {
        results,
        success: true,
        meta: {} as any,
      };
    }

    async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      const stmt = db.prepare(this.query);
      const info = (stmt.run as any)(...this.params);
      return {
        results: [] as T[],
        success: true,
        meta: {
          changes: Number(info.changes),
          last_row_id: Number(info.lastInsertRowid),
          duration: 0,
          served_by: 'mock',
        } as any,
      };
    }

    async raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<any> {
      const stmt = db.prepare(this.query);
      const rows = (stmt.all as any)(...this.params);
      return rows.map((r: Record<string, unknown>) => Object.values(r)) as unknown as T[];
    }
  }

  return {
    prepare(query: string) {
      return new MockD1PreparedStatement(query);
    },
    async dump() {
      return new ArrayBuffer(0);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push(await stmt.all<T>());
      }
      return results;
    },
    async exec(query: string) {
      db.exec(query);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}

const sampleValidPackage = {
  format: 'lcpack',
  schemaVersion: 1,
  metadata: {
    title: 'Cell Structure & Function',
    description: 'A study pack on cellular biology',
    author: 'Biology Department',
    createdAt: '2026-08-28T00:00:00.000Z',
    appVersion: '0.2.0',
    tags: ['biology', 'cells'],
  },
  materials: [
    {
      id: 'pkg_mat_001',
      title: 'Cell Biology Notes',
      description: 'Introduction to cell organelles',
      documentContent: '# Cell Biology\nHere is an image: ![Diagram](lc-asset://pkg_asset_001)',
      order: 1,
    },
  ],
  questions: [
    {
      id: 'pkg_q_001',
      materialId: 'pkg_mat_001',
      type: 'multiple_choice',
      prompt: 'What is the powerhouse of the cell?',
      payload: {
        options: [
          { id: 'opt_1', text: 'Mitochondria' },
          { id: 'opt_2', text: 'Nucleus' },
        ],
        correctOptionId: 'opt_1',
      },
      difficulty: 'easy',
      points: 10,
    },
  ],
  quizzes: [
    {
      id: 'pkg_quiz_001',
      materialId: 'pkg_mat_001',
      title: 'Cell Basics Quiz',
      items: [
        {
          questionId: 'pkg_q_001',
          order: 1,
        },
      ],
    },
  ],
  flashcards: [
    {
      id: 'pkg_card_001',
      materialId: 'pkg_mat_001',
      front: 'Mitochondria',
      back: 'Powerhouse of the cell',
    },
  ],
  assets: [
    {
      id: 'pkg_asset_001',
      filename: 'diagram.png',
      mimeType: 'image/png',
      dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  ],
};

describe('Cloud Sharing Protocol (Worker Endpoints)', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      DB: createMockD1(),
      SEED_TOKEN: 'test_seed_token',
    };
  });

  describe('POST /api/shares', () => {
    it('rejects non-json content-type with 415', async () => {
      const req = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'invalid',
      });
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(415);
    });

    it('rejects malformed json with 400', async () => {
      const req = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json',
      });
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(400);
    });

    it('rejects invalid StudyPackage with 422 and validation details', async () => {
      const invalidPackage = {
        format: 'invalid_format',
        schemaVersion: 99,
        metadata: {},
        materials: [],
      };

      const req = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: invalidPackage }),
      });
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(422);
      const json = await res.json() as { error: string; details: string[] };
      expect(json.error).toBe('StudyPackage validation failed.');
      expect(json.details.length).toBeGreaterThan(0);
    });

    it('rejects packages with undeclared asset references with 422', async () => {
      const brokenPackage = {
        ...sampleValidPackage,
        materials: [
          {
            id: 'pkg_mat_001',
            title: 'Cell Notes',
            documentContent: 'Image: ![Missing](lc-asset://pkg_asset_missing)',
          },
        ],
        assets: [],
      };

      const req = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: brokenPackage }),
      });
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(422);
      const json = await res.json() as { details: string[] };
      expect(json.details.some((d) => d.includes('references undeclared asset'))).toBe(true);
    });

    it('rejects passcode accessType when passcode is missing', async () => {
      const req = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: sampleValidPackage,
          accessType: 'passcode',
        }),
      });
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(400);
    });

    it('publishes valid public StudyPackage successfully and returns 201 with share ID and URL', async () => {
      const req = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user_creator_123',
        },
        body: JSON.stringify({
          package: sampleValidPackage,
          accessType: 'public',
        }),
      });
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(201);
      const data = await res.json() as PublishShareResponse;
      expect(data.id).toMatch(/^share_[a-zA-Z0-9]+$/);
      expect(data.title).toBe('Cell Structure & Function');
      expect(data.author).toBe('Biology Department');
      expect(data.accessType).toBe('public');
      expect(data.shareUrl).toBe(`/share/${data.id}`);
    });
  });

  describe('GET /api/shares/:id & View Tracking', () => {
    it('returns 404 for unknown share ID', async () => {
      const req = new Request('http://localhost/api/shares/share_nonexistent');
      const res = await worker.fetch(req, env);
      expect(res.status).toBe(404);
    });

    it('fetches published public share, returns package snapshot, and increments view count', async () => {
      // 1. Create share
      const createReq = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: sampleValidPackage }),
      });
      const createRes = await worker.fetch(createReq, env);
      const created = await createRes.json() as PublishShareResponse;

      // 2. Fetch share 1st time
      const getReq1 = new Request(`http://localhost/api/shares/${created.id}`);
      const getRes1 = await worker.fetch(getReq1, env);
      expect(getRes1.status).toBe(200);
      const data1 = await getRes1.json() as PublishedShareResponse;
      expect(data1.id).toBe(created.id);
      expect(data1.title).toBe('Cell Structure & Function');
      expect(data1.viewCount).toBe(1);
      expect((data1.package as any).materials.length).toBe(1);

      // 3. Fetch share 2nd time (viewCount increments)
      const getReq2 = new Request(`http://localhost/api/shares/${created.id}`);
      const getRes2 = await worker.fetch(getReq2, env);
      const data2 = await getRes2.json() as PublishedShareResponse;
      expect(data2.viewCount).toBe(2);
    });

    it('enforces passcode protection on passcode-protected shares', async () => {
      // 1. Create passcode share
      const createReq = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: sampleValidPackage,
          accessType: 'passcode',
          passcode: 'secret123',
        }),
      });
      const createRes = await worker.fetch(createReq, env);
      const created = await createRes.json() as PublishShareResponse;

      // 2. Fetch without passcode -> 401
      const getReqNoPass = new Request(`http://localhost/api/shares/${created.id}`);
      const resNoPass = await worker.fetch(getReqNoPass, env);
      expect(resNoPass.status).toBe(401);
      const err1 = await resNoPass.json() as { requiresPasscode: boolean };
      expect(err1.requiresPasscode).toBe(true);

      // 3. Fetch with wrong passcode -> 401
      const getReqWrong = new Request(`http://localhost/api/shares/${created.id}`, {
        headers: { 'X-Share-Passcode': 'wrong_pass' },
      });
      const resWrong = await worker.fetch(getReqWrong, env);
      expect(resWrong.status).toBe(401);

      // 4. Fetch with correct passcode in header -> 200
      const getReqHeader = new Request(`http://localhost/api/shares/${created.id}`, {
        headers: { 'X-Share-Passcode': 'secret123' },
      });
      const resHeader = await worker.fetch(getReqHeader, env);
      expect(resHeader.status).toBe(200);

      // 5. Fetch with correct passcode in query param -> 200
      const getReqQuery = new Request(`http://localhost/api/shares/${created.id}?passcode=secret123`);
      const resQuery = await worker.fetch(getReqQuery, env);
      expect(resQuery.status).toBe(200);
    });

    it('returns 410 when share has expired', async () => {
      const createReq = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: sampleValidPackage,
          expiresAt: '2020-01-01T00:00:00.000Z', // Expired
        }),
      });
      const createRes = await worker.fetch(createReq, env);
      const created = await createRes.json() as PublishShareResponse;

      const getReq = new Request(`http://localhost/api/shares/${created.id}`);
      const getRes = await worker.fetch(getReq, env);
      expect(getRes.status).toBe(410);
    });
  });

  describe('POST /api/shares/:id/download', () => {
    it('increments download count', async () => {
      const createReq = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: sampleValidPackage }),
      });
      const createRes = await worker.fetch(createReq, env);
      const created = await createRes.json() as PublishShareResponse;

      const dlReq = new Request(`http://localhost/api/shares/${created.id}/download`, {
        method: 'POST',
      });
      const dlRes = await worker.fetch(dlReq, env);
      expect(dlRes.status).toBe(200);
      const dlData = await dlRes.json() as { success: boolean; downloadCount: number };
      expect(dlData.downloadCount).toBe(1);
    });
  });

  describe('DELETE /api/shares/:id', () => {
    it('rejects unauthorized delete with 403', async () => {
      const createReq = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner_user',
        },
        body: JSON.stringify({ package: sampleValidPackage }),
      });
      const createRes = await worker.fetch(createReq, env);
      const created = await createRes.json() as PublishShareResponse;

      const delReq = new Request(`http://localhost/api/shares/${created.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer random_stranger' },
      });
      const delRes = await worker.fetch(delReq, env);
      expect(delRes.status).toBe(403);
    });

    it('allows owner to delete their share with 204', async () => {
      const createReq = new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner_user',
        },
        body: JSON.stringify({ package: sampleValidPackage }),
      });
      const createRes = await worker.fetch(createReq, env);
      const created = await createRes.json() as PublishShareResponse;

      const delReq = new Request(`http://localhost/api/shares/${created.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer owner_user' },
      });
      const delRes = await worker.fetch(delReq, env);
      expect(delRes.status).toBe(204);

      // Verify gone
      const getReq = new Request(`http://localhost/api/shares/${created.id}`);
      const getRes = await worker.fetch(getReq, env);
      expect(getRes.status).toBe(404);
    });
  });
});
