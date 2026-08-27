/**
 * Integration Tests for Cloud Sync Protocol (POST /api/sync/push, GET /api/sync/pull)
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../index';
import type { SyncPullResponse, SyncPushResponse } from '../sync';

function createMockD1(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_changes (
      sequence integer PRIMARY KEY AUTOINCREMENT,
      user_id text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      operation text NOT NULL,
      version integer,
      changed_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_idempotency (
      client_mutation_id text PRIMARY KEY,
      user_id text NOT NULL,
      device_id text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      processed_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_documents (
      user_id text NOT NULL,
      document_id text NOT NULL,
      version integer DEFAULT 1 NOT NULL,
      title text NOT NULL,
      content text NOT NULL,
      updated_at text NOT NULL,
      deleted_at text,
      PRIMARY KEY (user_id, document_id)
    );

    CREATE TABLE IF NOT EXISTS user_entities (
      user_id text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      payload text NOT NULL,
      updated_at text NOT NULL,
      deleted_at text,
      PRIMARY KEY (user_id, entity_type, entity_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sync_changes_user_seq ON sync_changes (user_id, sequence);
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
        meta: {
          changes: 0,
          last_row_id: 0,
          duration: 0,
          served_by: 'mock',
          size_after: 0,
          rows_read: results.length,
          rows_written: 0,
          changed_db: false,
        },
      };
    }

    async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      const stmt = db.prepare(this.query);
      const res = (stmt.run as any)(...this.params);
      const changesCount = Number(res.changes);
      return {
        results: [] as T[],
        success: true,
        meta: {
          changes: changesCount,
          last_row_id: Number(res.lastInsertRowid),
          duration: 0,
          served_by: 'mock',
          size_after: 0,
          rows_read: 0,
          rows_written: changesCount,
          changed_db: changesCount > 0,
        },
      };
    }

    async raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<any> {
      const stmt = db.prepare(this.query);
      const rows = (stmt.all as any)(...this.params);
      return rows.map((r: Record<string, unknown>) => Object.values(r)) as unknown as T[];
    }
  }

  const d1Mock: Partial<D1Database> = {
    prepare(query: string): D1PreparedStatement {
      return new MockD1PreparedStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push(await stmt.all<T>());
      }
      return results;
    },
    async exec(query: string): Promise<D1ExecResult> {
      db.exec(query);
      return { count: 1, duration: 0 };
    },
  };

  return d1Mock as D1Database;
}

describe('Worker Cloud Sync Protocol Endpoints', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      DB: createMockD1(),
    };
  });

  const pushMutations = async (
    mutations: unknown[],
    userId = 'test-user-1',
    deviceId = 'device-alpha',
  ): Promise<{ status: number; body: SyncPushResponse }> => {
    const req = new Request('https://api.project-lunaclair.workers.dev/api/sync/push', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({
        deviceId,
        mutations,
      }),
    });

    const res = await worker.fetch(req, env);
    const body = (await res.json()) as SyncPushResponse;
    return { status: res.status, body };
  };

  const pullChanges = async (
    cursor = 0,
    limit = 100,
    userId = 'test-user-1',
  ): Promise<{ status: number; body: SyncPullResponse }> => {
    const req = new Request(
      `https://api.project-lunaclair.workers.dev/api/sync/pull?cursor=${cursor}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'x-user-id': userId,
        },
      },
    );

    const res = await worker.fetch(req, env);
    const body = (await res.json()) as SyncPullResponse;
    return { status: res.status, body };
  };

  describe('Document Versioning (Model C - Optimistic CAS)', () => {
    it('pushes a new document and accepts it as version 1', async () => {
      const { status, body } = await pushMutations([
        {
          clientMutationId: 'mut-doc-1',
          entityType: 'document',
          entityId: 'doc-101',
          operation: 'UPSERT',
          baseVersion: 0,
          clientTimestamp: '2026-08-27T10:00:00.000Z',
          payload: {
            title: 'Cellular Biology',
            content: '# Introduction to Cells\nCells are the basic unit of life.',
          },
        },
      ]);

      expect(status).toBe(200);
      expect(body.accepted).toHaveLength(1);
      expect(body.accepted[0]).toEqual({
        clientMutationId: 'mut-doc-1',
        entityType: 'document',
        entityId: 'doc-101',
        newVersion: 1,
      });
      expect(body.conflicts).toHaveLength(0);
      expect(body.rejected).toHaveLength(0);
      expect(body.serverCursor).toBe(1);

      // Verify pull returns this document
      const pullRes = await pullChanges(0);
      expect(pullRes.status).toBe(200);
      expect(pullRes.body.changes).toHaveLength(1);
      expect(pullRes.body.changes[0]).toEqual({
        sequence: 1,
        entityType: 'document',
        entityId: 'doc-101',
        operation: 'UPSERT',
        version: 1,
        changedAt: '2026-08-27T10:00:00.000Z',
        data: {
          title: 'Cellular Biology',
          content: '# Introduction to Cells\nCells are the basic unit of life.',
          updatedAt: '2026-08-27T10:00:00.000Z',
        },
      });
    });

    it('advances document version on matching baseVersion CAS update', async () => {
      // Step 1: Create v1
      await pushMutations([
        {
          clientMutationId: 'mut-doc-v1',
          entityType: 'document',
          entityId: 'doc-102',
          operation: 'UPSERT',
          baseVersion: 0,
          clientTimestamp: '2026-08-27T10:00:00.000Z',
          payload: {
            title: 'Initial Title',
            content: 'Initial Content',
          },
        },
      ]);

      // Step 2: Update with baseVersion = 1 -> should become v2
      const { status, body } = await pushMutations([
        {
          clientMutationId: 'mut-doc-v2',
          entityType: 'document',
          entityId: 'doc-102',
          operation: 'UPSERT',
          baseVersion: 1,
          clientTimestamp: '2026-08-27T10:05:00.000Z',
          payload: {
            title: 'Updated Title',
            content: 'Updated Content',
          },
        },
      ]);

      expect(status).toBe(200);
      expect(body.accepted).toHaveLength(1);
      expect(body.accepted[0]).toEqual({
        clientMutationId: 'mut-doc-v2',
        entityType: 'document',
        entityId: 'doc-102',
        newVersion: 2,
      });
      expect(body.serverCursor).toBe(2);

      // Verify pull returns both changes in sequence order
      const pullRes = await pullChanges(0);
      expect(pullRes.body.changes).toHaveLength(2);
      expect(pullRes.body.changes[1].version).toBe(2);
      expect(pullRes.body.changes[1].data).toMatchObject({
        title: 'Updated Title',
        content: 'Updated Content',
      });
    });

    it('returns conflict with stored server version when baseVersion mismatches', async () => {
      // Step 1: Create v1
      await pushMutations([
        {
          clientMutationId: 'mut-doc-init',
          entityType: 'document',
          entityId: 'doc-103',
          operation: 'UPSERT',
          baseVersion: 0,
          clientTimestamp: '2026-08-27T10:00:00.000Z',
          payload: {
            title: 'Server Master Title',
            content: 'Server Master Content',
          },
        },
      ]);

      // Step 2: Another client updates to v2
      await pushMutations([
        {
          clientMutationId: 'mut-doc-other-client',
          entityType: 'document',
          entityId: 'doc-103',
          operation: 'UPSERT',
          baseVersion: 1,
          clientTimestamp: '2026-08-27T10:10:00.000Z',
          payload: {
            title: 'Client A Title',
            content: 'Client A Content',
          },
        },
      ]);

      // Step 3: Stale client attempts update with baseVersion = 1 (current is 2)
      const { status, body } = await pushMutations([
        {
          clientMutationId: 'mut-doc-stale',
          entityType: 'document',
          entityId: 'doc-103',
          operation: 'UPSERT',
          baseVersion: 1,
          clientTimestamp: '2026-08-27T10:12:00.000Z',
          payload: {
            title: 'Stale Client Title',
            content: 'Stale Client Content',
          },
        },
      ]);

      expect(status).toBe(200);
      expect(body.accepted).toHaveLength(0);
      expect(body.conflicts).toHaveLength(1);
      expect(body.conflicts[0]).toEqual({
        clientMutationId: 'mut-doc-stale',
        entityType: 'document',
        entityId: 'doc-103',
        serverVersion: 2,
        serverPayload: {
          title: 'Client A Title',
          content: 'Client A Content',
          updatedAt: '2026-08-27T10:10:00.000Z',
          deletedAt: null,
        },
      });
    });

    it('returns conflict when attempting to create a document that already exists', async () => {
      // Create v1
      await pushMutations([
        {
          clientMutationId: 'mut-doc-existing-init',
          entityType: 'document',
          entityId: 'doc-existing',
          operation: 'UPSERT',
          baseVersion: 0,
          clientTimestamp: '2026-08-27T10:00:00.000Z',
          payload: {
            title: 'Existing Doc',
            content: 'Existing Body',
          },
        },
      ]);

      // Attempt to create again with baseVersion = 0
      const { body } = await pushMutations([
        {
          clientMutationId: 'mut-doc-duplicate-create',
          entityType: 'document',
          entityId: 'doc-existing',
          operation: 'UPSERT',
          baseVersion: 0,
          clientTimestamp: '2026-08-27T10:01:00.000Z',
          payload: {
            title: 'Another Attempt',
            content: 'Another Body',
          },
        },
      ]);

      expect(body.accepted).toHaveLength(0);
      expect(body.conflicts).toHaveLength(1);
      expect(body.conflicts[0].serverVersion).toBe(1);
    });
  });

  describe('Last-Write-Wins Entities (Model A - highlight, drawing, flashcardReview)', () => {
    it('accepts initial highlight and updates when newer timestamp arrives', async () => {
      // Step 1: Initial highlight
      const { body: body1 } = await pushMutations([
        {
          clientMutationId: 'mut-hl-1',
          entityType: 'highlight',
          entityId: 'hl-001',
          operation: 'UPSERT',
          clientTimestamp: '2026-08-27T11:00:00.000Z',
          payload: {
            id: 'hl-001',
            documentId: 'doc-101',
            start: 10,
            end: 25,
            color: 'yellow',
            text: 'mitochondria is powerhouse',
            createdAt: '2026-08-27T11:00:00.000Z',
          },
        },
      ]);

      expect(body1.accepted).toHaveLength(1);
      expect(body1.accepted[0].entityId).toBe('hl-001');

      // Step 2: Older update arrives -> should be ignored (not written to journal)
      const { body: body2 } = await pushMutations([
        {
          clientMutationId: 'mut-hl-older',
          entityType: 'highlight',
          entityId: 'hl-001',
          operation: 'UPSERT',
          clientTimestamp: '2026-08-27T10:30:00.000Z',
          payload: {
            id: 'hl-001',
            documentId: 'doc-101',
            start: 5,
            end: 15,
            color: 'green',
            text: 'older text',
            createdAt: '2026-08-27T10:30:00.000Z',
          },
        },
      ]);

      expect(body2.accepted).toHaveLength(1); // Idempotently accepted but ignored

      // Step 3: Newer update arrives -> should overwrite and record journal
      const { body: body3 } = await pushMutations([
        {
          clientMutationId: 'mut-hl-newer',
          entityType: 'highlight',
          entityId: 'hl-001',
          operation: 'UPSERT',
          clientTimestamp: '2026-08-27T11:30:00.000Z',
          payload: {
            id: 'hl-001',
            documentId: 'doc-101',
            start: 10,
            end: 35,
            color: 'blue',
            text: 'mitochondria is powerhouse of cell',
            createdAt: '2026-08-27T11:00:00.000Z',
          },
        },
      ]);

      expect(body3.accepted).toHaveLength(1);

      // Verify pull: only initial insertion (seq 1) and newer update (seq 2) exist
      const pullRes = await pullChanges(0);
      expect(pullRes.body.changes).toHaveLength(2);
      expect(pullRes.body.changes[1].changedAt).toBe('2026-08-27T11:30:00.000Z');
      expect((pullRes.body.changes[1].data as Record<string, unknown>).color).toBe('blue');
    });

    it('handles flashcard review LWW updates and tombstones', async () => {
      // Push flashcard review
      await pushMutations([
        {
          clientMutationId: 'mut-fc-1',
          entityType: 'flashcardReview',
          entityId: 'card-001',
          operation: 'UPSERT',
          clientTimestamp: '2026-08-27T12:00:00.000Z',
          payload: {
            key: 'card-001',
            repetitions: 3,
            easeFactor: 2.5,
            intervalDays: 6,
            dueAt: '2026-09-02T12:00:00.000Z',
            lapses: 0,
            lastReviewedAt: '2026-08-27T12:00:00.000Z',
            reviewCount: 3,
          },
        },
      ]);

      // Soft delete flashcard review
      await pushMutations([
        {
          clientMutationId: 'mut-fc-delete',
          entityType: 'flashcardReview',
          entityId: 'card-001',
          operation: 'DELETE',
          clientTimestamp: '2026-08-27T12:30:00.000Z',
          payload: {},
        },
      ]);

      const pullRes = await pullChanges(0);
      expect(pullRes.body.changes).toHaveLength(2);
      expect(pullRes.body.changes[1].operation).toBe('DELETE');
      expect(pullRes.body.changes[1].data).toBeNull();
    });
  });

  describe('Append-Only Entities (Model B - quizSession)', () => {
    it('accepts new quiz session and ignores duplicate append safely', async () => {
      const sessionPayload = {
        id: 'session-xyz',
        quizId: 'quiz-001',
        mode: 'practice',
        status: 'completed',
        questionSnapshots: {},
        answers: [{ questionId: 'q1', selectedOptionIndex: 2, isCorrect: true, scoreEarned: 10 }],
        startedAt: '2026-08-27T13:00:00.000Z',
        completedAt: '2026-08-27T13:10:00.000Z',
      };

      // Step 1: Initial append
      const { body: body1 } = await pushMutations([
        {
          clientMutationId: 'mut-session-1',
          entityType: 'quizSession',
          entityId: 'session-xyz',
          operation: 'APPEND',
          clientTimestamp: '2026-08-27T13:10:00.000Z',
          payload: sessionPayload,
        },
      ]);

      expect(body1.accepted).toHaveLength(1);
      expect(body1.accepted[0].entityId).toBe('session-xyz');
      expect(body1.serverCursor).toBe(1);

      // Step 2: Duplicate append with different mutationId (e.g. multi-device concurrent sync)
      const { body: body2 } = await pushMutations([
        {
          clientMutationId: 'mut-session-2-duplicate',
          entityType: 'quizSession',
          entityId: 'session-xyz',
          operation: 'APPEND',
          clientTimestamp: '2026-08-27T13:10:00.000Z',
          payload: sessionPayload,
        },
      ]);

      expect(body2.accepted).toHaveLength(1);
      expect(body2.serverCursor).toBe(1); // No new change log sequence created

      // Pull returns exactly 1 change
      const pullRes = await pullChanges(0);
      expect(pullRes.body.changes).toHaveLength(1);
      expect(pullRes.body.changes[0].operation).toBe('APPEND');
      expect(pullRes.body.changes[0].data).toMatchObject({
        id: 'session-xyz',
        quizId: 'quiz-001',
      });
    });
  });

  describe('Idempotency & Replay Resilience', () => {
    it('returns accepted without duplicating journal entries on repeated mutation replay', async () => {
      const mutation = {
        clientMutationId: 'mut-replay-test',
        entityType: 'document',
        entityId: 'doc-replay',
        operation: 'UPSERT',
        baseVersion: 0,
        clientTimestamp: '2026-08-27T14:00:00.000Z',
        payload: {
          title: 'Idempotency Doc',
          content: 'Testing replay',
        },
      };

      // Push once
      const { body: body1 } = await pushMutations([mutation]);
      expect(body1.accepted).toHaveLength(1);
      expect(body1.serverCursor).toBe(1);

      // Replay same mutation
      const { body: body2 } = await pushMutations([mutation]);
      expect(body2.accepted).toHaveLength(1);
      expect(body2.accepted[0].clientMutationId).toBe('mut-replay-test');
      expect(body2.serverCursor).toBe(1); // Server cursor did NOT advance

      // Check pull only has 1 change
      const pullRes = await pullChanges(0);
      expect(pullRes.body.changes).toHaveLength(1);
    });
  });

  describe('Delta Pull Protocol & Pagination', () => {
    it('correctly handles cursor pagination and hasMore flag', async () => {
      // Create 5 mutations
      const mutations = [1, 2, 3, 4, 5].map((num) => ({
        clientMutationId: `mut-page-${num}`,
        entityType: 'drawing',
        entityId: `draw-${num}`,
        operation: 'UPSERT',
        clientTimestamp: `2026-08-27T15:0${num}:00.000Z`,
        payload: {
          id: `draw-${num}`,
          documentId: 'doc-1',
          color: '#ff0000',
          thickness: 2,
          points: [{ x: num, y: num }],
          createdAt: `2026-08-27T15:0${num}:00.000Z`,
        },
      }));

      await pushMutations(mutations);

      // Page 1: cursor 0, limit 2
      const page1 = await pullChanges(0, 2);
      expect(page1.body.changes).toHaveLength(2);
      expect(page1.body.changes[0].sequence).toBe(1);
      expect(page1.body.changes[1].sequence).toBe(2);
      expect(page1.body.newCursor).toBe(2);
      expect(page1.body.hasMore).toBe(true);

      // Page 2: cursor 2, limit 2
      const page2 = await pullChanges(page1.body.newCursor, 2);
      expect(page2.body.changes).toHaveLength(2);
      expect(page2.body.changes[0].sequence).toBe(3);
      expect(page2.body.changes[1].sequence).toBe(4);
      expect(page2.body.newCursor).toBe(4);
      expect(page2.body.hasMore).toBe(true);

      // Page 3: cursor 4, limit 2
      const page3 = await pullChanges(page2.body.newCursor, 2);
      expect(page3.body.changes).toHaveLength(1);
      expect(page3.body.changes[0].sequence).toBe(5);
      expect(page3.body.newCursor).toBe(5);
      expect(page3.body.hasMore).toBe(false);

      // Page 4: cursor 5, limit 2 (empty, caught up)
      const page4 = await pullChanges(page3.body.newCursor, 2);
      expect(page4.body.changes).toHaveLength(0);
      expect(page4.body.newCursor).toBe(5);
      expect(page4.body.hasMore).toBe(false);
    });

    it('isolates sync changes across different users', async () => {
      // User Alpha pushes mutation
      await pushMutations(
        [
          {
            clientMutationId: 'mut-alpha-1',
            entityType: 'highlight',
            entityId: 'hl-alpha',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T16:00:00.000Z',
            payload: { text: 'Alpha user highlight' },
          },
        ],
        'user-alpha',
      );

      // User Beta pulls changes -> should receive nothing
      const betaPull = await pullChanges(0, 10, 'user-beta');
      expect(betaPull.body.changes).toHaveLength(0);
      expect(betaPull.body.newCursor).toBe(0);

      // User Alpha pulls changes -> receives their change
      const alphaPull = await pullChanges(0, 10, 'user-alpha');
      expect(alphaPull.body.changes).toHaveLength(1);
      expect(alphaPull.body.changes[0].entityId).toBe('hl-alpha');
    });
  });

  describe('Validation & Error Handling', () => {
    it('rejects unsupported entity types', async () => {
      const { body } = await pushMutations([
        {
          clientMutationId: 'mut-invalid-type',
          entityType: 'unsupportedType' as any,
          entityId: 'id-1',
          operation: 'UPSERT',
          clientTimestamp: '2026-08-27T16:00:00.000Z',
          payload: {},
        },
      ]);

      expect(body.accepted).toHaveLength(0);
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0].reason).toContain('Unsupported entity type');
    });

    it('returns 400 when push payload is missing required deviceId', async () => {
      const req = new Request('https://api.project-lunaclair.workers.dev/api/sync/push', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({
          mutations: [],
        }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(400);
    });

    it('returns 405 when invalid method is used for sync endpoints', async () => {
      const getPushReq = new Request('https://api.project-lunaclair.workers.dev/api/sync/push', {
        method: 'GET',
      });
      const res1 = await worker.fetch(getPushReq, env);
      expect(res1.status).toBe(405);

      const postPullReq = new Request('https://api.project-lunaclair.workers.dev/api/sync/pull', {
        method: 'POST',
      });
      const res2 = await worker.fetch(postPullReq, env);
      expect(res2.status).toBe(405);
    });
  });
});
