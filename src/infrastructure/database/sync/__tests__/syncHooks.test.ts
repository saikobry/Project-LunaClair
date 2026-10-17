import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { LunaClairDatabase, openVaultDatabase, clearVaultDatabaseCache } from '../../schema/LunaClairDatabase';
import { installSyncHooks } from '../syncHooks';
import { withOrigin, SyncScopeError } from '../transactionContext';
import { createClock, type HlcClock } from '../../../../domain/sync/reconcilers/plugins/MergePlugin';
import { AppendOnlyViolation } from '../../../../domain/sync/reconcilers/plugins/AppendOnlyPlugin';

describe('syncHooks: Dexie Engine Mutation Capture and Scope Hooks', () => {
  const TEST_DB_NAME = 'test_sync_hooks_vault';
  let db: LunaClairDatabase;
  let clock: HlcClock;

  beforeEach(async () => {
    db = new LunaClairDatabase(TEST_DB_NAME);
    clock = createClock('device_test_1');
    installSyncHooks(db, clock);
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) {
      db.close();
    }
    await Dexie.delete(TEST_DB_NAME);
  });

  describe('Synchronous Scope Guard', () => {
    it('throws SyncScopeError on raw write without withOrigin scope', async () => {
      await expect(
        db.highlights.add({
          id: 'hl-unscoped',
          documentId: 'doc-1',
          text: 'Unscoped annotation',
          color: 'yellow',
          start: 0,
          end: 10,
          createdAt: '2026-10-17T00:00:00.000Z',
        })
      ).rejects.toThrow(SyncScopeError);

      const count = await db.highlights.count();
      expect(count).toBe(0);
    });

    it('rejects update outside withOrigin scope', async () => {
      await withOrigin(db, 'bypass', [db.highlights], async () => {
        await db.highlights.add({
          id: 'hl-seeded',
          documentId: 'doc-1',
          text: 'Seeded annotation',
          color: 'yellow',
          start: 0,
          end: 10,
          createdAt: '2026-10-17T00:00:00.000Z',
        });
      });

      await expect(
        db.highlights.update('hl-seeded', { color: 'blue' })
      ).rejects.toThrow(SyncScopeError);

      const item = await db.highlights.get('hl-seeded');
      expect(item?.color).toBe('yellow');
    });

    it('rejects delete outside withOrigin scope', async () => {
      await withOrigin(db, 'bypass', [db.highlights], async () => {
        await db.highlights.add({
          id: 'hl-seeded-del',
          documentId: 'doc-1',
          text: 'Seeded',
          color: 'yellow',
          start: 0,
          end: 10,
          createdAt: '2026-10-17T00:00:00.000Z',
        });
      });

      await expect(
        db.highlights.delete('hl-seeded-del')
      ).rejects.toThrow(SyncScopeError);

      const count = await db.highlights.count();
      expect(count).toBe(1);
    });
  });

  describe('Local Mutation Capture and Stamping', () => {
    it('stamps _hlc on create and emits mutation to syncQueue', async () => {
      await withOrigin(db, 'local', [db.highlights], async () => {
        await db.highlights.add({
          id: 'hl-local-1',
          documentId: 'doc-1',
          text: 'Local note',
          color: 'green',
          start: 5,
          end: 15,
          createdAt: '2026-10-17T00:00:00.000Z',
        });
      });

      const row = (await db.highlights.get('hl-local-1')) as unknown as { _hlc?: string };
      expect(row?._hlc).toBeDefined();
      expect(typeof row?._hlc).toBe('string');

      const queueItems = await db.syncQueue.toArray();
      expect(queueItems.length).toBe(1);
      const op = queueItems[0] as unknown as { entity: string; key: string; op: string; hlc: string };
      expect(op.entity).toBe('highlight');
      expect(op.key).toBe('hl-local-1');
      expect(op.op).toBe('put');
      expect(op.hlc).toBe(row?._hlc);
    });

    it('stamps updated _hlc on update and emits put mutation', async () => {
      await withOrigin(db, 'local', [db.highlights], async () => {
        await db.highlights.add({
          id: 'hl-local-upd',
          documentId: 'doc-1',
          text: 'Original',
          color: 'green',
          start: 0,
          end: 5,
          createdAt: '2026-10-17T00:00:00.000Z',
        });
      });

      const firstRow = (await db.highlights.get('hl-local-upd')) as unknown as { _hlc?: string };
      const firstHlc = firstRow?._hlc;
      await db.syncQueue.clear();

      await withOrigin(db, 'local', [db.highlights], async () => {
        await db.highlights.update('hl-local-upd', { color: 'pink' });
      });

      const updatedRow = (await db.highlights.get('hl-local-upd')) as unknown as { _hlc?: string; color: string };
      expect(updatedRow?.color).toBe('pink');
      expect(updatedRow?._hlc).toBeDefined();
      expect(updatedRow?._hlc).not.toBe(firstHlc);

      const queueItems = await db.syncQueue.toArray();
      expect(queueItems.length).toBe(1);
      const op = queueItems[0] as unknown as { entity: string; key: string; op: string };
      expect(op.op).toBe('put');
    });

    it('does not emit mutation when update modifications are empty', async () => {
      const row = {
        id: 'hl-same',
        documentId: 'doc-1',
        text: 'Text',
        color: 'green' as const,
        start: 0,
        end: 4,
        createdAt: '2026-10-17T00:00:00.000Z',
      };

      await withOrigin(db, 'local', [db.highlights], async () => {
        await db.highlights.add(row);
      });
      await db.syncQueue.clear();

      await withOrigin(db, 'local', [db.highlights], async () => {
        await db.highlights.put(row);
      });

      const queueItems = await db.syncQueue.toArray();
      expect(queueItems.length).toBe(0);
    });

    it('emits tombstone and del mutation to syncQueue on delete', async () => {
      await withOrigin(db, 'local', [db.highlights], async () => {
        await db.highlights.add({
          id: 'hl-del-target',
          documentId: 'doc-1',
          text: 'Target to remove',
          color: 'pink',
          start: 0,
          end: 6,
          createdAt: '2026-10-17T00:00:00.000Z',
        });
      });
      await db.syncQueue.clear();

      await withOrigin(db, 'local', [db.highlights], async () => {
        await db.highlights.delete('hl-del-target');
      });

      const queueItems = await db.syncQueue.toArray();
      expect(queueItems.length).toBe(1);
      const op = queueItems[0] as unknown as { entity: string; key: string; op: string; hlc: string };
      expect(op.entity).toBe('highlight');
      expect(op.key).toBe('hl-del-target');
      expect(op.op).toBe('del');

      const tombstones = await db.tombstones.toArray();
      expect(tombstones.length).toBe(1);
      expect(tombstones[0].id).toBe('highlight:hl-del-target');
      expect(tombstones[0].entity).toBe('highlight');
      expect(tombstones[0].key).toBe('hl-del-target');
      expect(tombstones[0].hlc).toBe(op.hlc);
    });
  });

  describe('Remote Echo Suppression', () => {
    it('completely suppresses queue and tombstone emission during remote transactions', async () => {
      await withOrigin(db, 'remote', [db.highlights], async () => {
        await db.highlights.add({
          id: 'hl-remote-1',
          documentId: 'doc-1',
          text: 'Remote content',
          color: 'blue',
          start: 0,
          end: 10,
          createdAt: '2026-10-17T00:00:00.000Z',
        });
        await db.highlights.update('hl-remote-1', { color: 'green' });
        await db.highlights.delete('hl-remote-1');
      });

      const queueCount = await db.syncQueue.count();
      const tombstoneCount = await db.tombstones.count();

      expect(queueCount).toBe(0);
      expect(tombstoneCount).toBe(0);
    });
  });

  describe('Bypass Prune Behavior', () => {
    it('clears records without emitting tombstones or outbox entries', async () => {
      await withOrigin(db, 'local', [db.highlights], async () => {
        await db.highlights.bulkAdd([
          {
            id: 'hl-prune-1',
            documentId: 'doc-1',
            text: 'Prune 1',
            color: 'pink',
            start: 0,
            end: 5,
            createdAt: '2026-10-17T00:00:00.000Z',
          },
          {
            id: 'hl-prune-2',
            documentId: 'doc-1',
            text: 'Prune 2',
            color: 'blue',
            start: 5,
            end: 10,
            createdAt: '2026-10-17T00:00:00.000Z',
          },
        ]);
      });

      await db.syncQueue.clear();
      await db.tombstones.clear();

      await withOrigin(db, 'bypass', [db.highlights], async () => {
        await db.highlights.clear();
      });

      expect(await db.highlights.count()).toBe(0);
      expect(await db.syncQueue.count()).toBe(0);
      expect(await db.tombstones.count()).toBe(0);
    });
  });

  describe('CasDraft and AppendOnly Strategy Policies', () => {
    it('tracks _rev and _anc on casDraft documentContents modifications', async () => {
      await withOrigin(db, 'local', [db.documentContents], async () => {
        await db.documentContents.add({
          documentId: 'doc-cas',
          title: 'CAS Document',
          content: 'Initial revision',
          updatedAt: '2026-10-17T00:00:00.000Z',
          version: 1,
        });
      });

      const initial = (await db.documentContents.get('doc-cas')) as unknown as {
        _hlc: string;
        _rev: string;
        _anc: string[];
      };
      expect(initial._hlc).toBeDefined();
      expect(initial._rev).toBeDefined();
      expect(initial._anc).toEqual([]);

      await withOrigin(db, 'local', [db.documentContents], async () => {
        await db.documentContents.update('doc-cas', {
          content: 'Second revision',
        });
      });

      const updated = (await db.documentContents.get('doc-cas')) as unknown as {
        _hlc: string;
        _rev: string;
        _anc: string[];
      };
      expect(updated._rev).not.toBe(initial._rev);
      expect(updated._anc).toEqual([initial._rev]);
    });

    it('rejects local updates on append-only reviewLogs table', async () => {
      await withOrigin(db, 'local', [db.reviewLogs], async () => {
        await db.reviewLogs.add({
          id: 'log-1',
          cardKey: 'card-1',
          kind: 'review',
          rating: 4,
          at: 1000,
          deviceId: 'device_test_1',
        });
      });

      await expect(
        withOrigin(db, 'local', [db.reviewLogs], async () => {
          await db.reviewLogs.update('log-1', { rating: 1 });
        })
      ).rejects.toThrow(AppendOnlyViolation);
    });
  });

  describe('Selective Sync Category Filtering', () => {
    it('skips outbox emission on create when table category is disabled', async () => {
      const dbFiltered = new LunaClairDatabase('test_filter_db');
      const filteredClock = createClock('device_filter_1');
      installSyncHooks(dbFiltered, filteredClock, (category) => category !== 'annotations');
      await dbFiltered.open();

      try {
        await withOrigin(dbFiltered, 'local', [dbFiltered.highlights], async () => {
          await dbFiltered.highlights.add({
            id: 'hl-filtered-create',
            documentId: 'doc-1',
            text: 'Filtered out',
            color: 'yellow',
            start: 0,
            end: 5,
            createdAt: '2026-10-17T00:00:00.000Z',
          });
        });

        const row = (await dbFiltered.highlights.get('hl-filtered-create')) as unknown as { _hlc?: string };
        expect(row?._hlc).toBeDefined();

        const queueCount = await dbFiltered.syncQueue.count();
        expect(queueCount).toBe(0);
      } finally {
        dbFiltered.close();
        await Dexie.delete('test_filter_db');
      }
    });

    it('skips outbox emission on update when table category is disabled', async () => {
      const dbFiltered = new LunaClairDatabase('test_filter_upd_db');
      const filteredClock = createClock('device_filter_2');
      installSyncHooks(dbFiltered, filteredClock, (category) => category !== 'annotations');
      await dbFiltered.open();

      try {
        await withOrigin(dbFiltered, 'bypass', [dbFiltered.highlights], async () => {
          await dbFiltered.highlights.add({
            id: 'hl-filtered-upd',
            documentId: 'doc-1',
            text: 'Initial',
            color: 'yellow',
            start: 0,
            end: 5,
            createdAt: '2026-10-17T00:00:00.000Z',
          });
        });

        await withOrigin(dbFiltered, 'local', [dbFiltered.highlights], async () => {
          await dbFiltered.highlights.update('hl-filtered-upd', { color: 'green' });
        });

        const queueCount = await dbFiltered.syncQueue.count();
        expect(queueCount).toBe(0);
      } finally {
        dbFiltered.close();
        await Dexie.delete('test_filter_upd_db');
      }
    });

    it('skips outbox and tombstone emission on delete when table category is disabled', async () => {
      const dbFiltered = new LunaClairDatabase('test_filter_del_db');
      const filteredClock = createClock('device_filter_3');
      installSyncHooks(dbFiltered, filteredClock, (category) => category !== 'annotations');
      await dbFiltered.open();

      try {
        await withOrigin(dbFiltered, 'bypass', [dbFiltered.highlights], async () => {
          await dbFiltered.highlights.add({
            id: 'hl-filtered-del',
            documentId: 'doc-1',
            text: 'To be deleted',
            color: 'yellow',
            start: 0,
            end: 5,
            createdAt: '2026-10-17T00:00:00.000Z',
          });
        });

        await withOrigin(dbFiltered, 'local', [dbFiltered.highlights], async () => {
          await dbFiltered.highlights.delete('hl-filtered-del');
        });

        const queueCount = await dbFiltered.syncQueue.count();
        const tombstoneCount = await dbFiltered.tombstones.count();
        expect(queueCount).toBe(0);
        expect(tombstoneCount).toBe(0);
      } finally {
        dbFiltered.close();
        await Dexie.delete('test_filter_del_db');
      }
    });

    it('installs hooks automatically in openVaultDatabase and ignores double-attachment', async () => {
      clearVaultDatabaseCache();
      const vaultName = 'test_vault_auto_hooks';
      await Dexie.delete(vaultName);
      const vaultDb = openVaultDatabase(vaultName);
      await vaultDb.open();

      try {
        expect(vaultDb.isSyncHooksInstalled()).toBe(true);

        // Attempting to install sync hooks again does not double-attach or throw
        expect(() => {
          installSyncHooks(vaultDb, createClock('device_duplicate'));
        }).not.toThrow();

        // Mutating within scope produces exactly one outbox entry
        await withOrigin(vaultDb, 'local', [vaultDb.highlights], async () => {
          await vaultDb.highlights.add({
            id: 'hl-auto-1',
            documentId: 'doc-auto',
            text: 'Auto hooked annotation',
            color: 'yellow',
            start: 0,
            end: 10,
            createdAt: '2026-10-17T00:00:00.000Z',
          });
        });

        const queueCount = await vaultDb.syncQueue.count();
        expect(queueCount).toBe(1);
      } finally {
        vaultDb.close();
        clearVaultDatabaseCache();
        await Dexie.delete(vaultName);
      }
    });
  });
});
