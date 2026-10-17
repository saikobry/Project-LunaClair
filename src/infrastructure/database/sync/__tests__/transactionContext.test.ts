import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie, { type Transaction } from 'dexie';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import {
  originOf,
  withOrigin,
  OriginConflictError,
  type TaggedTransaction,
} from '../transactionContext';

describe('transactionContext: origin tagging and inheritance', () => {
  const TEST_DB_NAME = 'test_tx_context_vault';
  let db: LunaClairDatabase;

  beforeEach(() => {
    db = new LunaClairDatabase(TEST_DB_NAME);
  });

  afterEach(async () => {
    if (db.isOpen()) {
      db.close();
    }
    await Dexie.delete(TEST_DB_NAME);
  });

  describe('originOf', () => {
    it('defaults untagged or null/undefined transactions to local', () => {
      expect(originOf(null)).toBe('local');
      expect(originOf(undefined)).toBe('local');
      expect(originOf({} as Transaction)).toBe('local');
    });

    it('reads explicit origin from tagged transaction', () => {
      const localTx: TaggedTransaction = { origin: 'local' } as TaggedTransaction;
      const remoteTx: TaggedTransaction = { origin: 'remote' } as TaggedTransaction;
      const bypassTx: TaggedTransaction = { origin: 'bypass' } as TaggedTransaction;

      expect(originOf(localTx)).toBe('local');
      expect(originOf(remoteTx)).toBe('remote');
      expect(originOf(bypassTx)).toBe('bypass');
    });

    it('walks parent chain to inherit origin when child is untagged', () => {
      const rootTx: TaggedTransaction = { origin: 'remote' } as TaggedTransaction;
      const childTx: TaggedTransaction = { parent: rootTx } as TaggedTransaction;
      const grandchildTx: TaggedTransaction = { parent: childTx } as TaggedTransaction;

      expect(originOf(childTx)).toBe('remote');
      expect(originOf(grandchildTx)).toBe('remote');
    });

    it('prefers direct child origin over parent origin', () => {
      const parentTx: TaggedTransaction = { origin: 'local' } as TaggedTransaction;
      const childTx: TaggedTransaction = { origin: 'bypass', parent: parentTx } as TaggedTransaction;

      expect(originOf(childTx)).toBe('bypass');
    });
  });

  describe('withOrigin', () => {
    it('executes transaction with designated origin and return value', async () => {
      await db.open();

      const result = await withOrigin(db, 'remote', [db.materials], async (tx) => {
        expect(originOf(tx)).toBe('remote');
        return 42;
      });

      expect(result).toBe(42);
    });

    it('automatically includes sync infrastructure tables in transaction scope', async () => {
      await db.open();

      await withOrigin(db, 'local', [db.materials], async (tx) => {
        expect(tx.storeNames).toContain('materials');
        expect(tx.storeNames).toContain('syncQueue');
        expect(tx.storeNames).toContain('tombstones');
        expect(tx.storeNames).toContain('heldOps');
        expect(tx.storeNames).toContain('conflictDrafts');
      });
    });

    it('allows nested withOrigin calls with identical origin', async () => {
      await db.open();

      let nestedRan = false;
      await withOrigin(db, 'remote', [db.materials], async (outerTx) => {
        expect(originOf(outerTx)).toBe('remote');

        await withOrigin(db, 'remote', [db.materials], async (innerTx) => {
          expect(originOf(innerTx)).toBe('remote');
          nestedRan = true;
        });
      });

      expect(nestedRan).toBe(true);
    });

    it('refuses nested withOrigin calls with conflicting origin', async () => {
      await db.open();

      await expect(
        withOrigin(db, 'remote', [db.materials], async () => {
          await withOrigin(db, 'local', [db.materials], async () => {});
        })
      ).rejects.toThrow(OriginConflictError);

      await expect(
        withOrigin(db, 'local', [db.materials], async () => {
          await withOrigin(db, 'bypass', [db.materials], async () => {});
        })
      ).rejects.toThrow(OriginConflictError);
    });

    it('propagates transaction callback rejections and rolls back', async () => {
      await db.open();

      await expect(
        withOrigin(db, 'local', [db.materials], async () => {
          await db.materials.add({
            id: 'm-fail',
            documentId: 'doc-fail',
            title: 'Will roll back',
            order: 0,
            createdAt: '2026-10-17T00:00:00.000Z',
            updatedAt: '2026-10-17T00:00:00.000Z',
          });
          throw new Error('Simulated abort');
        })
      ).rejects.toThrow('Simulated abort');

      const count = await db.materials.count();
      expect(count).toBe(0);
    });
  });
});
