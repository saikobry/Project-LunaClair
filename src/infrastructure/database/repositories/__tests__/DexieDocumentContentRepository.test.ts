import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { openVaultDatabase, clearVaultDatabaseCache, type LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieDocumentContentRepository } from '../DexieDocumentContentRepository';
import type { ImportedDocumentContent } from '../../../../domain/reader/repositories/DocumentContentRepository';
import type { JournalOp } from '../../../../domain/sync/reconcilers/plugins/MergePlugin';

describe('DexieDocumentContentRepository (Sync Mutation Capture)', () => {
  const TEST_DB_NAME = 'test_document_content_repo_vault';
  let db: LunaClairDatabase;
  let repo: DexieDocumentContentRepository;

  beforeEach(async () => {
    clearVaultDatabaseCache();
    await Dexie.delete(TEST_DB_NAME);
    db = openVaultDatabase(TEST_DB_NAME);
    await db.open();
    repo = new DexieDocumentContentRepository(db);
  });

  afterEach(async () => {
    if (db.isOpen()) {
      db.close();
    }
    clearVaultDatabaseCache();
    await Dexie.delete(TEST_DB_NAME);
  });

  it('put writes to documentContents and captures exactly 1 outbox row', async () => {
    const doc: ImportedDocumentContent = {
      documentId: 'doc-1',
      title: 'Pathology Notes',
      content: '# Pathology',
      updatedAt: '2026-10-17T00:00:00.000Z',
    };

    await repo.put(doc);

    const stored = await repo.getByDocumentId('doc-1');
    expect(stored).not.toBeNull();
    expect(stored?.title).toBe('Pathology Notes');
    expect(stored?.version).toBe(1);

    const queueItems = (await db.syncQueue.toArray()) as unknown as JournalOp[];
    expect(queueItems).toHaveLength(1);
    expect(queueItems[0].entity).toBe('documentContent');
    expect(queueItems[0].key).toBe('doc-1');
    expect(queueItems[0].op).toBe('put');
  });

  it('deleteByDocumentId asserts exactly 1 tombstone and exactly 1 delete outbox item', async () => {
    const doc: ImportedDocumentContent = {
      documentId: 'doc-del-1',
      title: 'To Be Deleted',
      content: 'Goodbye',
      updatedAt: '2026-10-17T00:00:00.000Z',
    };

    await repo.put(doc);
    expect(await db.syncQueue.count()).toBe(1);

    await repo.deleteByDocumentId('doc-del-1');

    const stored = await repo.getByDocumentId('doc-del-1');
    expect(stored).toBeNull();

    const queueItems = (await db.syncQueue.toArray()) as unknown as JournalOp[];
    expect(queueItems).toHaveLength(2);
    const delItem = queueItems.find((q) => q.op === 'del');
    expect(delItem).toBeDefined();
    expect(delItem?.key).toBe('doc-del-1');

    const tombstones = await db.tombstones.toArray();
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].entity).toBe('documentContent');
    expect(tombstones[0].key).toBe('doc-del-1');
  });

  it('multiple puts increment outbox row count by exactly 1 without duplicates or stale revisions', async () => {
    const doc: ImportedDocumentContent = {
      documentId: 'doc-multi',
      title: 'Initial Title',
      content: 'Revision 0',
      updatedAt: '2026-10-17T00:00:00.000Z',
    };

    await repo.put(doc);
    expect(await db.syncQueue.count()).toBe(1);

    await repo.put({
      ...doc,
      title: 'Updated Title',
      content: 'Revision 1',
      updatedAt: '2026-10-17T00:01:00.000Z',
    });
    expect(await db.syncQueue.count()).toBe(2);

    await repo.put({
      ...doc,
      title: 'Final Title',
      content: 'Revision 2',
      updatedAt: '2026-10-17T00:02:00.000Z',
    });
    expect(await db.syncQueue.count()).toBe(3);

    const queueItems = (await db.syncQueue.toArray()) as unknown as JournalOp[];
    expect(queueItems.map((q) => q.op)).toEqual(['put', 'put', 'put']);
    expect(queueItems.map((q) => q.key)).toEqual(['doc-multi', 'doc-multi', 'doc-multi']);
  });
});
