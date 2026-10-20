import Dexie, { type Transaction } from 'dexie';
import type { LunaClairDatabase } from '../schema/LunaClairDatabase';
import type { SyncQueueItem, SyncEntityType } from '../../../domain/sync/models/sync.types';
import { syncedTables, type SyncCategory } from '../../../domain/sync/policy/SyncPolicy';
import { isSyncCategoryEnabled } from '../../../domain/sync/preferences/SyncCategoryPreferences';
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

export type CategoryFilter = (category: SyncCategory) => boolean;

/**
 * Installs synchronous mutation capture hooks across all authoritative synchronized tables.
 *
 * Rules:
 * - Scopes are verified synchronously; missing sync queue or tombstones throws SyncScopeError.
 * - 'local' transactions stamp version fields (_hlc, _rev, _anc) and emit mutations to syncQueue and tombstones.
 * - Non-local ('remote' or 'bypass') transactions completely skip outbox and tombstone emission to prevent echoes or phantom tombstones.
 * - If a table's sync category is disabled via preferences, outbox and tombstone emission is skipped.
 */
export function installSyncHooks(
  db: LunaClairDatabase,
  clock: HlcClock,
  isCategoryEnabled: CategoryFilter = isSyncCategoryEnabled
): void {
  if (db.isSyncHooksInstalled?.() || (db as unknown as { syncHooksInstalled?: boolean }).syncHooksInstalled) {
    return;
  }
  db.markSyncHooksInstalled?.();
  (db as unknown as { syncHooksInstalled?: boolean }).syncHooksInstalled = true;

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
      if (!isCategoryEnabled(cfg.category)) {
        return;
      }
      const queueTableName = tx.storeNames.includes('syncQueue') ? 'syncQueue' : 'outbox';
      const now = new Date().toISOString();
      const clientMutationId = (cap.op as { id?: string }).id ?? crypto.randomUUID();
      const queueRecord: SyncQueueItem & {
        entity?: string;
        key?: string;
        op?: string;
        hlc?: string;
        deviceId?: string;
        schemaVersion?: number;
        value?: unknown;
      } = {
        id: (cap.op as { id?: string }).id ?? `${cfg.entity}:${key}:${cap.op.hlc}`,
        clientMutationId,
        entityType: cfg.entity as SyncEntityType,
        entityId: key,
        operation: cap.op.op === 'del' ? 'DELETE' : 'UPSERT',
        payload: cap.op.value,
        clientTimestamp: now,
        status: 'pending',
        createdAt: now,
        retryCount: 0,
        // Preserve JournalOp metadata so existing tests and reconcilers can access them:
        entity: cfg.entity,
        key,
        op: cap.op.op,
        hlc: cap.op.hlc,
        deviceId: cap.op.deviceId,
        schemaVersion: cap.op.schemaVersion,
        value: cap.op.value,
      };

      tx.table(queueTableName)
        .put(queueRecord)
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
      const keyPath = table.schema.primKey.keyPath;
      const key = String(
        pk !== undefined
          ? pk
          : (typeof keyPath === 'string' ? (obj as Record<string, unknown>)[keyPath] : undefined) ??
            (obj as { id?: unknown; documentId?: unknown }).id ??
            (obj as { id?: unknown; documentId?: unknown }).documentId ??
            ''
      );
      const cap = plugin.capture({ kind: 'create', key, next: obj as object }, ctx);
      if (!cap) return;
      Object.assign(obj, cap.stamp);
      emit(tx, cap, key);
    });

    table.hook('updating', function (mods, pk, prev, tx) {
      if (originOf(tx) !== 'local' || Object.keys(mods).length === 0) return;
      guard(tx);
      const keyPath = table.schema.primKey.keyPath;
      const key = String(
        pk !== undefined
          ? pk
          : (typeof keyPath === 'string' ? (prev as Record<string, unknown>)?.[keyPath] : undefined) ??
            (prev as { id?: unknown; documentId?: unknown })?.id ??
            (prev as { id?: unknown; documentId?: unknown })?.documentId ??
            ''
      );
      const next = applyMods(prev as object, mods as Record<string, unknown>);
      const cap = plugin.capture({ kind: 'update', key, prev: prev as object, next }, ctx);
      if (!cap) return;
      emit(tx, cap, key);
      return cap.stamp as Record<string, unknown>;
    });

    table.hook('deleting', function (pk, prev, tx) {
      if (originOf(tx) !== 'local') return;
      guard(tx);
      const keyPath = table.schema.primKey.keyPath;
      const key = String(
        pk !== undefined
          ? pk
          : (typeof keyPath === 'string' ? (prev as Record<string, unknown>)?.[keyPath] : undefined) ??
            (prev as { id?: unknown; documentId?: unknown })?.id ??
            (prev as { id?: unknown; documentId?: unknown })?.documentId ??
            ''
      );
      const cap = plugin.capture({ kind: 'delete', key, prev: (prev ?? {}) as object }, ctx);
      if (cap) {
        emit(tx, cap, key);
      }
    });
  }
}
