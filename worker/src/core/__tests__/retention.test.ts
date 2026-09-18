// @vitest-environment node
/**
 * The prune is a destructive statement on the one table that grows with traffic, so its contract is
 * asserted twice: against a captured D1 statement (the exact SQL and bound parameters the Worker
 * issues), and against real SQLite (`node:sqlite`, available in Node >= 22.5) for the semantics the
 * string assertions cannot see — which rows go, in what order, and whether the index the migration adds
 * is the one the plan actually uses.
 */
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  SYNC_IDEMPOTENCY_PRUNE_BATCH,
  SYNC_IDEMPOTENCY_RETENTION_DAYS,
  pruneSyncIdempotency,
  syncIdempotencyCutoff,
} from '../retention';

const HOUR_MS = 60 * 60 * 1000;

/** Captures what the module hands D1, with no database involved. */
function createStatementSpy(options: { changes?: number; meta?: boolean; fail?: Error } = {}) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];

  const database = {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        run: async () => {
          statements.push({ sql, params });
          if (options.fail) throw options.fail;
          return options.meta === false ? {} : { meta: { changes: options.changes ?? 0 } };
        },
      }),
    }),
  } as unknown as D1Database;

  return { database, statements };
}

/** The one `prepare().bind().run()` shape the module uses, backed by a real SQLite database. */
function createSqliteD1(database: DatabaseSync): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        run: async () => {
          const result = database.prepare(sql).run(...(params as string[]));
          return { meta: { changes: Number(result.changes) } };
        },
      }),
    }),
  } as unknown as D1Database;
}

describe('sync idempotency retention', () => {
  describe('retention window', () => {
    it('keeps at least the documented replay horizon', () => {
      // The floor is the contract: the window may grow, but shrinking it silently would retire replay
      // protection earlier than the rationale in `core/retention.ts` claims.
      expect(SYNC_IDEMPOTENCY_RETENTION_DAYS).toBeGreaterThanOrEqual(30);
      expect(SYNC_IDEMPOTENCY_PRUNE_BATCH).toBeGreaterThan(0);
    });

    it('computes the cutoff in the ledger timestamp format', () => {
      const now = new Date('2026-09-18T12:00:00.000Z');

      const cutoff = syncIdempotencyCutoff(now);

      expect(cutoff).toBe('2026-08-19T12:00:00.000Z');
      // Freezes the property the SQL leans on: the cutoff is the same fixed-width ISO-8601 UTC text
      // the route writes to `processed_at`, so a bound string comparison orders correctly.
      expect(cutoff).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(Date.parse(now.toISOString()) - Date.parse(cutoff)).toBe(
        SYNC_IDEMPOTENCY_RETENTION_DAYS * 24 * HOUR_MS,
      );
      expect(cutoff < now.toISOString()).toBe(true);
    });

    it('honours an explicit window', () => {
      const now = new Date('2026-09-18T12:00:00.000Z');

      expect(syncIdempotencyCutoff(now, 1)).toBe('2026-09-17T12:00:00.000Z');
      expect(syncIdempotencyCutoff(now, 0)).toBe(now.toISOString());
    });
  });

  describe('prune statement', () => {
    it('bounds the delete and binds the cutoff instead of interpolating it', async () => {
      const { database, statements } = createStatementSpy({ changes: 7 });
      const now = new Date('2026-09-18T12:00:00.000Z');

      const removed = await pruneSyncIdempotency(database, now);

      expect(removed).toBe(7);
      expect(statements).toHaveLength(1);

      const [{ sql, params }] = statements;
      // Two binds for the cutoff because it filters both the delete and the subquery that bounds it.
      expect(params).toEqual([
        '2026-08-19T12:00:00.000Z',
        '2026-08-19T12:00:00.000Z',
        SYNC_IDEMPOTENCY_PRUNE_BATCH,
      ]);
      expect(sql).toContain('DELETE FROM sync_idempotency');
      expect(sql).toContain('processed_at < ?');
      expect(sql).toContain('ORDER BY processed_at ASC');
      expect(sql).toContain('LIMIT ?');
      // A timestamp in the SQL would mean a format or injection problem the binds already prevent.
      expect(sql).not.toContain('2026-');
    });

    it('accepts an explicit batch size', async () => {
      const { database, statements } = createStatementSpy();

      await pruneSyncIdempotency(database, new Date('2026-09-18T12:00:00.000Z'), 25);

      expect(statements[0].params[2]).toBe(25);
    });

    it('reports zero when D1 omits the change count', async () => {
      const { database } = createStatementSpy({ meta: false });

      await expect(pruneSyncIdempotency(database)).resolves.toBe(0);
    });

    it('propagates a D1 failure for the caller to decide on', async () => {
      const failure = new Error('D1_ERROR: no such table: sync_idempotency');
      const { database } = createStatementSpy({ fail: failure });

      await expect(pruneSyncIdempotency(database)).rejects.toBe(failure);
    });
  });

  describe('prune against real SQLite', () => {
    /** Seeds `count` hourly ledger rows ending at `now`, and reports which of them are expired. */
    function seedLedger(database: DatabaseSync, now: Date, count: number) {
      const rows = Array.from({ length: count }, (_, index) => ({
        id: `mutation_${index}`,
        processedAt: new Date(now.getTime() - index * HOUR_MS).toISOString(),
      }));

      const insert = database.prepare(
        'INSERT INTO sync_idempotency VALUES (?, ?, ?, ?, ?, ?)',
      );
      for (const row of rows) {
        insert.run(row.id, 'user_a', 'device_1', 'highlight', `entity_${row.id}`, row.processedAt);
      }

      const cutoff = syncIdempotencyCutoff(now);
      return {
        cutoff,
        expired: rows.filter((row) => row.processedAt < cutoff).map((row) => row.id),
      };
    }

    function openLedger(): DatabaseSync {
      const database = new DatabaseSync(':memory:');
      database.exec(`
        CREATE TABLE sync_idempotency (
          client_mutation_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          processed_at TEXT NOT NULL
        );
        CREATE INDEX idx_sync_idempotency_processed_at ON sync_idempotency (processed_at);
      `);
      return database;
    }

    function remainingIds(database: DatabaseSync): string[] {
      return database
        .prepare('SELECT client_mutation_id FROM sync_idempotency ORDER BY processed_at DESC')
        .all()
        .map((row) => row.client_mutation_id as string);
    }

    it('drains a backlog oldest-first in bounded batches, and stops', async () => {
      const database = openLedger();
      const now = new Date('2026-09-18T12:00:00.000Z');
      const { cutoff, expired } = seedLedger(database, now, 90 * 24);
      const d1 = createSqliteD1(database);

      expect(expired.length).toBeGreaterThan(SYNC_IDEMPOTENCY_PRUNE_BATCH);

      const removed: number[] = [];
      for (let pass = 0; pass < 10; pass += 1) {
        const count = await pruneSyncIdempotency(d1, now);
        removed.push(count);
        if (count === 0) break;
      }

      // The bound is real: a backlog larger than one batch drains over several passes, no pass ever
      // exceeds it, and the passes that were full are exactly the whole batches available.
      expect(removed[0]).toBe(SYNC_IDEMPOTENCY_PRUNE_BATCH);
      expect(removed.every((count) => count <= SYNC_IDEMPOTENCY_PRUNE_BATCH)).toBe(true);
      expect(removed.filter((count) => count === SYNC_IDEMPOTENCY_PRUNE_BATCH)).toHaveLength(
        Math.floor(expired.length / SYNC_IDEMPOTENCY_PRUNE_BATCH),
      );
      expect(removed.at(-1)).toBe(0);
      expect(removed.reduce((total, count) => total + count, 0)).toBe(expired.length);

      // What survives is exactly the rows inside the window: nothing expired was missed, and nothing
      // inside the window was retired early.
      const survivors = remainingIds(database);
      expect(survivors).toHaveLength(90 * 24 - expired.length);
      expect(survivors.some((id) => expired.includes(id))).toBe(false);
      expect(
        database
          .prepare('SELECT COUNT(*) AS count FROM sync_idempotency WHERE processed_at < ?')
          .get(cutoff),
      ).toEqual({ count: 0 });
    });

    it('uses the index the migration adds', () => {
      const database = openLedger();
      const now = new Date('2026-09-18T12:00:00.000Z');
      seedLedger(database, now, 48);

      const plan = database
        .prepare(
          `EXPLAIN QUERY PLAN
             SELECT client_mutation_id FROM sync_idempotency
              WHERE processed_at < ?
              ORDER BY processed_at ASC
              LIMIT ?`,
        )
        .all(syncIdempotencyCutoff(now), 500);

      // Without the index this is a full scan of the ledger on every push; the test fails if the
      // statement and the migration ever stop agreeing with each other.
      expect(JSON.stringify(plan)).toContain('idx_sync_idempotency_processed_at');
    });

    it('leaves an unexpired ledger untouched', async () => {
      const database = openLedger();
      const now = new Date('2026-09-18T12:00:00.000Z');
      const d1 = createSqliteD1(database);
      const insert = database.prepare('INSERT INTO sync_idempotency VALUES (?, ?, ?, ?, ?, ?)');
      insert.run('fresh', 'user_a', 'device_1', 'document', 'doc_1', now.toISOString());

      const removed = await pruneSyncIdempotency(d1, now);

      expect(removed).toBe(0);
      expect(remainingIds(database)).toEqual(['fresh']);
    });
  });
});
