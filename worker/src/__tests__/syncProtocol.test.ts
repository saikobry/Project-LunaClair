/**
 * Integration Tests for Cloud Sync Protocol (POST /api/sync/push, GET /api/sync/pull)
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../index';
import type { SyncPullResponse, SyncPushResponse } from '../routes/sync';

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
      if (params.length > 100) {
        throw new Error(
          `D1_ERROR: too many SQL variables at offset 0: SQLITE_ERROR (bound ${params.length} parameters, max is 100)`,
        );
      }
      this.query = query;
      this.params = params;
    }

    bind(...values: unknown[]): D1PreparedStatement {
      if (values.length > 100) {
        throw new Error(
          `D1_ERROR: too many SQL variables at offset 0: SQLITE_ERROR (bound ${values.length} parameters, max is 100)`,
        );
      }
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

      // Replay same mutation
      const { body: body2 } = await pushMutations([mutation]);
      expect(body2.accepted).toHaveLength(1);
      expect(body2.accepted[0].clientMutationId).toBe('mut-replay-test');

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

    it('hydrates a pull page with more than 49 distinct entity pairs without exceeding D1 bound-parameter ceiling', async () => {
      // 60 distinct entity pairs: 1 + (2 * 60) = 121 bound params without chunking.
      // D1 caps statements at 100 parameters, requiring hydration in chunks <= 49.
      const entityCount = 60;
      const mutations = Array.from({ length: entityCount }, (_, i) => ({
        clientMutationId: `mut-bound-entity-${i + 1}`,
        entityType: i % 2 === 0 ? 'highlight' : 'drawing',
        entityId: `entity-${i + 1}`,
        operation: 'UPSERT',
        clientTimestamp: `2026-08-27T16:00:00.${String(i).padStart(3, '0')}Z`,
        payload: {
          id: `entity-${i + 1}`,
          data: `content-${i + 1}`,
        },
      }));

      const { status: pushStatus, body: pushBody } = await pushMutations(
        mutations,
        'user-bound-entity',
      );
      expect(pushStatus).toBe(200);
      expect(pushBody.accepted).toHaveLength(entityCount);

      const pullRes = await pullChanges(0, 100, 'user-bound-entity');
      expect(pullRes.status).toBe(200);
      expect(pullRes.body.changes).toHaveLength(entityCount);

      for (let i = 0; i < entityCount; i++) {
        const expectedId = `entity-${i + 1}`;
        const change = pullRes.body.changes.find((c) => c.entityId === expectedId);
        expect(change).toBeDefined();
        expect(change?.data).toMatchObject({
          id: expectedId,
          data: `content-${i + 1}`,
        });
      }
    });

    it('hydrates a pull page with more than 98 document ids without exceeding D1 bound-parameter ceiling', async () => {
      // 105 distinct documents: 1 + 105 = 106 bound params without chunking.
      // D1 caps statements at 100 parameters, requiring hydration in chunks <= 98.
      const docCount = 105;
      const mutations = Array.from({ length: docCount }, (_, i) => ({
        clientMutationId: `mut-bound-doc-${i + 1}`,
        entityType: 'document',
        entityId: `doc-${i + 1}`,
        operation: 'UPSERT',
        baseVersion: 0,
        clientTimestamp: `2026-08-27T17:00:00.${String(i).padStart(3, '0')}Z`,
        payload: {
          title: `Document ${i + 1}`,
          content: `Content for doc ${i + 1}`,
        },
      }));

      const { status: pushStatus, body: pushBody } = await pushMutations(
        mutations,
        'user-bound-doc',
      );
      expect(pushStatus).toBe(200);
      expect(pushBody.accepted).toHaveLength(docCount);

      const pullRes = await pullChanges(0, 150, 'user-bound-doc');
      expect(pullRes.status).toBe(200);
      expect(pullRes.body.changes).toHaveLength(docCount);

      for (let i = 0; i < docCount; i++) {
        const expectedId = `doc-${i + 1}`;
        const change = pullRes.body.changes.find((c) => c.entityId === expectedId);
        expect(change).toBeDefined();
        expect(change?.data).toMatchObject({
          title: `Document ${i + 1}`,
          content: `Content for doc ${i + 1}`,
        });
      }
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

  describe('Worker Auth Gate & Identity Resolution', () => {
    const createJwt = (payloadObj: Record<string, unknown>): string => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify(payloadObj));
      return `${header}.${payload}.mockSignature`;
    };

    it('derives userId from JWT "sub" claim in Authorization Bearer header', async () => {
      const jwtToken = createJwt({ sub: 'user-from-jwt-sub' });
      const req = new Request('https://api.project-lunaclair.workers.dev/api/sync/push', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({
          deviceId: 'device-auth-1',
          mutations: [
            {
              clientMutationId: 'mut-auth-sub',
              entityType: 'highlight',
              entityId: 'hl-auth-1',
              operation: 'UPSERT',
              clientTimestamp: '2026-08-27T17:00:00.000Z',
              payload: { text: 'Authenticated via JWT sub' },
            },
          ],
        }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(200);

      // Verify that pull with the same JWT receives the data
      const pullReq = new Request('https://api.project-lunaclair.workers.dev/api/sync/pull?cursor=0', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
      });
      const pullRes = await worker.fetch(pullReq, env);
      const pullBody = (await pullRes.json()) as SyncPullResponse;
      expect(pullBody.changes).toHaveLength(1);
      expect(pullBody.changes[0].entityId).toBe('hl-auth-1');

      // Verify that another user does NOT see this data
      const otherPullReq = new Request('https://api.project-lunaclair.workers.dev/api/sync/pull?cursor=0', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${createJwt({ sub: 'other-user' })}`,
        },
      });
      const otherPullRes = await worker.fetch(otherPullReq, env);
      const otherPullBody = (await otherPullRes.json()) as SyncPullResponse;
      expect(otherPullBody.changes).toHaveLength(0);
    });

    it('derives userId from JWT "userId" claim in Authorization Bearer header', async () => {
      const jwtToken = createJwt({ userId: 'user-from-jwt-userId-claim' });
      const req = new Request('https://api.project-lunaclair.workers.dev/api/sync/push', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({
          deviceId: 'device-auth-2',
          mutations: [
            {
              clientMutationId: 'mut-auth-userid',
              entityType: 'highlight',
              entityId: 'hl-auth-2',
              operation: 'UPSERT',
              clientTimestamp: '2026-08-27T17:00:00.000Z',
              payload: { text: 'Authenticated via JWT userId' },
            },
          ],
        }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(200);

      const pullReq = new Request('https://api.project-lunaclair.workers.dev/api/sync/pull?cursor=0', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
      });
      const pullRes = await worker.fetch(pullReq, env);
      const pullBody = (await pullRes.json()) as SyncPullResponse;
      expect(pullBody.changes).toHaveLength(1);
      expect(pullBody.changes[0].entityId).toBe('hl-auth-2');
    });

    it('derives userId from raw Bearer token string when not a JWT', async () => {
      const req = new Request('https://api.project-lunaclair.workers.dev/api/sync/push', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer raw-session-token-xyz',
        },
        body: JSON.stringify({
          deviceId: 'device-auth-3',
          mutations: [
            {
              clientMutationId: 'mut-auth-raw',
              entityType: 'highlight',
              entityId: 'hl-auth-3',
              operation: 'UPSERT',
              clientTimestamp: '2026-08-27T17:00:00.000Z',
              payload: { text: 'Authenticated via raw bearer token' },
            },
          ],
        }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(200);

      const pullReq = new Request('https://api.project-lunaclair.workers.dev/api/sync/pull?cursor=0', {
        method: 'GET',
        headers: {
          authorization: 'Bearer raw-session-token-xyz',
        },
      });
      const pullRes = await worker.fetch(pullReq, env);
      const pullBody = (await pullRes.json()) as SyncPullResponse;
      expect(pullBody.changes).toHaveLength(1);
      expect(pullBody.changes[0].entityId).toBe('hl-auth-3');
    });

    it('enforces Authorization Bearer precedence over x-user-id header', async () => {
      const jwtToken = createJwt({ sub: 'authoritative-user' });
      const req = new Request('https://api.project-lunaclair.workers.dev/api/sync/push', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${jwtToken}`,
          'x-user-id': 'spoofed-user-id',
        },
        body: JSON.stringify({
          deviceId: 'device-precedence',
          mutations: [
            {
              clientMutationId: 'mut-precedence',
              entityType: 'highlight',
              entityId: 'hl-prec-1',
              operation: 'UPSERT',
              clientTimestamp: '2026-08-27T17:00:00.000Z',
              payload: { text: 'Precedence test' },
            },
          ],
        }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(200);

      // Data is under 'authoritative-user', NOT 'spoofed-user-id'
      const authPull = await worker.fetch(
        new Request('https://api.project-lunaclair.workers.dev/api/sync/pull?cursor=0', {
          headers: { authorization: `Bearer ${jwtToken}` },
        }),
        env,
      );
      expect(((await authPull.json()) as SyncPullResponse).changes).toHaveLength(1);

      const spoofedPull = await worker.fetch(
        new Request('https://api.project-lunaclair.workers.dev/api/sync/pull?cursor=0', {
          headers: { 'x-user-id': 'spoofed-user-id' },
        }),
        env,
      );
      expect(((await spoofedPull.json()) as SyncPullResponse).changes).toHaveLength(0);
    });

    it('falls back to "user_default" when neither Authorization nor x-user-id header is provided', async () => {
      const req = new Request('https://api.project-lunaclair.workers.dev/api/sync/push', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: 'device-default',
          mutations: [
            {
              clientMutationId: 'mut-default',
              entityType: 'highlight',
              entityId: 'hl-def-1',
              operation: 'UPSERT',
              clientTimestamp: '2026-08-27T17:00:00.000Z',
              payload: { text: 'Default user' },
            },
          ],
        }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(200);

      const pullReq = new Request('https://api.project-lunaclair.workers.dev/api/sync/pull?cursor=0', {
        method: 'GET',
      });
      const pullRes = await worker.fetch(pullReq, env);
      const pullBody = (await pullRes.json()) as SyncPullResponse;
      expect(pullBody.changes).toHaveLength(1);
      expect(pullBody.changes[0].entityId).toBe('hl-def-1');
    });
  });
});
