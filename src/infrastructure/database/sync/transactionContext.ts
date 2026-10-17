import Dexie, { type Table, type Transaction } from 'dexie';
import type { LunaClairDatabase } from '../schema/LunaClairDatabase';

/**
 * Transaction origin determining sync capture behavior:
 * - 'local': user-initiated mutation; stamped and emitted to outbox and tombstones
 * - 'remote': inbound replication; applied without outbox/tombstone emission (prevents echo loops)
 * - 'bypass': maintenance operations (pruning, cache clearing); uncaptured (prevents phantom tombstones)
 */
export type TxOrigin = 'local' | 'remote' | 'bypass';

export type TaggedTransaction = Transaction & {
  origin?: TxOrigin;
  parent?: Transaction;
};

/**
 * Determines transaction origin by inspecting the transaction or walking its parent chain.
 * Untagged transactions default to 'local' for safety.
 */
export function originOf(tx: Transaction | null | undefined): TxOrigin {
  for (let t = tx as TaggedTransaction | null | undefined; t; t = t.parent as TaggedTransaction | undefined) {
    if (t.origin) {
      return t.origin;
    }
  }
  return 'local';
}

export class SyncScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncScopeError';
  }
}

export class OriginConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OriginConflictError';
  }
}

/**
 * Runs a transactional scope tagged with a specific origin.
 * Automatically includes synchronization infrastructure tables in scope.
 * Guards against nested transactions attempting to switch origin.
 */
export async function withOrigin<T>(
  db: LunaClairDatabase,
  origin: TxOrigin,
  tables: Table[],
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  const cur = Dexie.currentTransaction;
  if (cur) {
    const curOrigin = originOf(cur);
    if (curOrigin !== origin) {
      throw new OriginConflictError(`nested transaction origin ${origin} inside ${curOrigin}`);
    }
  }

  const defaultTables: Table[] = [];
  if (db.syncQueue) defaultTables.push(db.syncQueue);
  if (db.tombstones) defaultTables.push(db.tombstones);
  if (db.heldOps) defaultTables.push(db.heldOps);
  if (db.conflictDrafts) defaultTables.push(db.conflictDrafts);

  const extended = db as unknown as { outbox?: Table; syncCursor?: Table };
  if (extended.outbox) defaultTables.push(extended.outbox);
  if (extended.syncCursor) defaultTables.push(extended.syncCursor);

  const scope = Array.from(new Set([...tables, ...defaultTables]));

  return db.transaction('rw', scope, async (tx) => {
    (tx as TaggedTransaction).origin = origin;
    return fn(tx);
  });
}
