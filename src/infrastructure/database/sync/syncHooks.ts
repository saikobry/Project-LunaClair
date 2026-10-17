import Dexie, { type Transaction } from 'dexie';
import type { LunaClairDatabase } from '../schema/LunaClairDatabase';
import { syncedTables } from '../../../domain/sync/policy/SyncPolicy';
import {
  type HlcClock,
  type CaptureCtx,
  type CaptureResult,
  PLUGINS,
  toWire,
} from '../../../domain/sync/reconcilers/plugins/MergePlugin';
import { originOf, SyncScopeError } from './transactionContext';

function applyMods<T extends object>(prev: T, mods: Record<string, unknown>): T {
  const next = structuredClone(prev);
  for (const [kp, v] of Object.entries(mods)) {
    if (v === undefined) {
      Dexie.delByKeyPath(next, kp);
    } else {
      Dexie.setByKeyPath(next, kp, v);
    }
  }
  return next;
}

/**
 * Installs synchronous mutation capture hooks across all authoritative synchronized tables.
 *
 * Rules:
 * - Scopes are verified synchronously; missing sync queue or tombstones throws SyncScopeError.
 * - 'local' transactions stamp version fields (_hlc, _rev, _anc) and emit mutations to syncQueue and tombstones.
 * - Non-local ('remote' or 'bypass') transactions completely skip outbox and tombstone emission to prevent echoes or phantom tombstones.
 */
export function installSyncHooks(db: LunaClairDatabase, clock: HlcClock): void {
  for (const [name, cfg] of syncedTables()) {
    if (!db.tables.some((t) => t.name === name)) {
      continue;
    }

    const table = db.table(name);
    const plugin = PLUGINS[cfg.mergeStrategy];
    if (!plugin) {
      continue;
    }

    const ctx: CaptureCtx = {
      clock,
      entity: cfg.entity,
      schemaVersion: cfg.schemaVersion,
      wire: (r) => toWire(r, cfg.excludeFields),
    };

    const guard = (tx: Transaction) => {
      const hasQueue = tx.storeNames.includes('syncQueue') || tx.storeNames.includes('outbox');
      if (!hasQueue) {
        throw new SyncScopeError(`write to ${name} outside withOrigin(): syncQueue not in transaction scope`);
      }
      if (!tx.storeNames.includes('tombstones')) {
        throw new SyncScopeError(`write to ${name} outside withOrigin(): tombstones not in transaction scope`);
      }
    };

    const emit = (tx: Transaction, cap: CaptureResult<object>, key: string) => {
      const queueTableName = tx.storeNames.includes('syncQueue') ? 'syncQueue' : 'outbox';
      const queueRecord = {
        id: (cap.op as { id?: string }).id ?? `${cfg.entity}:${key}:${cap.op.hlc}`,
        ...cap.op,
      };

      tx.table(queueTableName)
        .add(queueRecord)
        .catch((err: unknown) => {
          console.error('sync capture failed; aborting write', err);
          tx.abort();
        });

      if (cap.tombstone) {
        tx.table('tombstones')
          .put({
            id: `${cfg.entity}:${key}`,
            entity: cfg.entity,
            key,
            hlc: cap.op.hlc,
          })
          .catch((err: unknown) => {
            console.error('sync capture failed; aborting write', err);
            tx.abort();
          });
      }
    };

    table.hook('creating', function (pk, obj, tx) {
      if (originOf(tx) !== 'local') return;
      guard(tx);
      const key = String(pk !== undefined ? pk : (obj as { id?: unknown }).id ?? '');
      const cap = plugin.capture({ kind: 'create', key, next: obj as object }, ctx);
      if (!cap) return;
      Object.assign(obj, cap.stamp);
      emit(tx, cap, key);
    });

    table.hook('updating', function (mods, pk, prev, tx) {
      if (originOf(tx) !== 'local' || Object.keys(mods).length === 0) return;
      guard(tx);
      const key = String(pk !== undefined ? pk : (prev as { id?: unknown })?.id ?? '');
      const next = applyMods(prev as object, mods as Record<string, unknown>);
      const cap = plugin.capture({ kind: 'update', key, prev: prev as object, next }, ctx);
      if (!cap) return;
      emit(tx, cap, key);
      return cap.stamp as Record<string, unknown>;
    });

    table.hook('deleting', function (pk, prev, tx) {
      if (originOf(tx) !== 'local') return;
      guard(tx);
      const key = String(pk !== undefined ? pk : (prev as { id?: unknown })?.id ?? '');
      const cap = plugin.capture({ kind: 'delete', key, prev: (prev ?? {}) as object }, ctx);
      if (cap) {
        emit(tx, cap, key);
      }
    });
  }
}
