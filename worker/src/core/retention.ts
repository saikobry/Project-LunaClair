/**
 * Retention for the sync idempotency ledger.
 *
 * `sync_idempotency` is a deduplication ledger: it exists so a retried mutation gets its original
 * answer instead of being applied twice. It is also the only sync table that grows with traffic and is
 * never otherwise reclaimed, so it needs a retention window — and the window *is* the design, because
 * pruning too eagerly re-opens the replay hole the ledger exists to close.
 *
 * **Window: 30 days** (`SYNC_IDEMPOTENCY_RETENTION_DAYS`). It has to outlive the longest plausible
 * replay delay, which is bounded by how long a device can hold an unsent mutation: the client's outbox
 * drains whenever the app runs with connectivity, so replays are measured in minutes and the offline
 * stretches that delay them in days. 30 days is far beyond any realistic stretch and matches the usual
 * order for idempotency-key retention. A shorter window buys almost nothing — the ledger is one row
 * per mutation — while retiring an entry early is what costs a redundant change-log row or a conflict
 * response.
 *
 * **After expiry the ledger is not the only guard**, which is what makes expiring anything safe
 * (verified per model in `routes/sync.ts`): a replayed `document` mutation fails its CAS or finds the
 * row already present and returns a conflict — no write; a replayed `highlight` / `drawing` /
 * `flashcardReview` carries the timestamp the stored row already holds, so LWW takes it as an update
 * and rewrites the same payload — no data change, one redundant `sync_changes` row; a replayed
 * `quizSession` finds its entity and is accepted without a second insert. Expiry therefore costs log
 * noise and a conflict response, never duplicated data.
 *
 * **Timestamps are ISO-8601 UTC text** (`new Date().toISOString()`, the timestamp contract in
 * `worker/AGENTS.md`), fixed-width, so a bound string comparison orders correctly. The cutoff is
 * produced the same way rather than through SQL date functions, so no row can be missed by a format
 * difference.
 *
 * **Pruning rides the push path** (see `handleSyncPush`), bounded per call and best-effort. That is
 * sufficient without a scheduled trigger, and needs no new deployment configuration: the ledger only
 * grows when a push records a mutation, so pruning is driven by exactly the traffic that creates rows.
 * With no traffic there is nothing new to expire — an idle account's ledger stops growing instead of
 * being swept.
 */

/** Days of replay protection the ledger keeps after a mutation is processed. */
export const SYNC_IDEMPOTENCY_RETENTION_DAYS = 30;

/**
 * Rows deleted per prune pass. The delete is a `LIMIT`ed subquery rather than an unbounded `DELETE`, so
 * a backlog drains across successive pushes instead of turning one request into a long write.
 */
export const SYNC_IDEMPOTENCY_PRUNE_BATCH = 500;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The oldest `processed_at` still covered by the retention window, as the same ISO-8601 UTC text the
 * ledger stores. Entries strictly older than this are replay-protection expired.
 */
export function syncIdempotencyCutoff(
  now: Date,
  retentionDays: number = SYNC_IDEMPOTENCY_RETENTION_DAYS,
): string {
  return new Date(now.getTime() - retentionDays * MS_PER_DAY).toISOString();
}

/**
 * Deletes at most `batchSize` expired ledger entries and returns how many were removed.
 *
 * Raw D1 rather than the Drizzle query builder on purpose: the batch bound is the point, and it lives
 * in a `LIMIT`ed subquery (`DELETE` has no `LIMIT` in SQLite without a build option D1 does not
 * enable). The subquery is ordered by `processed_at` so the oldest entries go first and
 * `idx_sync_idempotency_processed_at` serves both the selection and the delete predicate.
 *
 * Callers own failure handling: this throws on a D1 error so a caller can decide whether retention is
 * load-bearing for its response (it is not for a push, which has already committed — see
 * `handleSyncPush`).
 */
export async function pruneSyncIdempotency(
  database: D1Database,
  now: Date = new Date(),
  batchSize: number = SYNC_IDEMPOTENCY_PRUNE_BATCH,
): Promise<number> {
  const cutoff = syncIdempotencyCutoff(now);

  const result = await database
    .prepare(
      `DELETE FROM sync_idempotency
         WHERE processed_at < ?
           AND client_mutation_id IN (
             SELECT client_mutation_id FROM sync_idempotency
              WHERE processed_at < ?
              ORDER BY processed_at ASC
              LIMIT ?
           )`,
    )
    .bind(cutoff, cutoff, batchSize)
    .run();

  return result.meta?.changes ?? 0;
}
