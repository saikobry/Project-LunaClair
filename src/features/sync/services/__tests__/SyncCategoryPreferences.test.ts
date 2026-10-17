import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {
  SyncCategoryPreferences,
  DEFAULT_SYNC_CATEGORY_PREFERENCES,
  SYNC_CATEGORY_STORAGE_KEY,
} from '../SyncCategoryPreferences';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { installSyncHooks } from '../../../../infrastructure/database/sync/syncHooks';
import { withOrigin } from '../../../../infrastructure/database/sync/transactionContext';
import { createClock } from '../../../../domain/sync/reconcilers/plugins/MergePlugin';
import { getTablesForCategory } from '../../../../domain/sync/policy/SyncPolicy';

describe('SyncCategoryPreferences Service', () => {
  let memoryStorage: Record<string, string>;
  let mockStorage: Storage;
  let service: SyncCategoryPreferences;

  beforeEach(() => {
    memoryStorage = {};
    mockStorage = {
      getItem: vi.fn((key: string) => memoryStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        memoryStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete memoryStorage[key];
      }),
      clear: vi.fn(() => {
        memoryStorage = {};
      }),
      key: vi.fn(() => null),
      length: 0,
    };
    service = new SyncCategoryPreferences(mockStorage);
  });

  it('initializes with all default categories enabled', () => {
    const prefs = service.getPreferences();
    expect(prefs).toEqual(DEFAULT_SYNC_CATEGORY_PREFERENCES);
    expect(prefs.annotations).toBe(true);
    expect(prefs.flashcards).toBe(true);
    expect(prefs.quizHistory).toBe(true);
    expect(prefs.customMaterials).toBe(true);
  });

  it('correctly reports enabled state for category aliases', () => {
    expect(service.isCategoryEnabled('annotations')).toBe(true);
    expect(service.isCategoryEnabled('flashcards')).toBe(true);
    expect(service.isCategoryEnabled('quizHistory')).toBe(true);
    expect(service.isCategoryEnabled('studyHistory')).toBe(true);
    expect(service.isCategoryEnabled('customMaterials')).toBe(true);

    service.setCategoryEnabled('quizHistory', false);
    expect(service.isCategoryEnabled('quizHistory')).toBe(false);
    expect(service.isCategoryEnabled('studyHistory')).toBe(false);
  });

  it('updates state and persists to storage when category is changed', () => {
    service.setCategoryEnabled('annotations', false);

    expect(service.getPreferences().annotations).toBe(false);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      SYNC_CATEGORY_STORAGE_KEY,
      expect.stringContaining('"annotations":false')
    );
  });

  it('toggles category boolean values', () => {
    service.toggleCategory('flashcards');
    expect(service.getPreferences().flashcards).toBe(false);

    service.toggleCategory('flashcards');
    expect(service.getPreferences().flashcards).toBe(true);
  });

  it('notifies subscribers on preference change', () => {
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    service.setCategoryEnabled('customMaterials', false);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ customMaterials: false })
    );

    unsubscribe();
    service.setCategoryEnabled('customMaterials', true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('resets preferences back to defaults', () => {
    service.setCategoryEnabled('annotations', false);
    service.setCategoryEnabled('flashcards', false);
    expect(service.getPreferences().annotations).toBe(false);

    service.reset();
    expect(service.getPreferences()).toEqual(DEFAULT_SYNC_CATEGORY_PREFERENCES);
  });

  it('restores stored preferences from storage on initialization', () => {
    memoryStorage[SYNC_CATEGORY_STORAGE_KEY] = JSON.stringify({
      annotations: false,
      flashcards: true,
      quizHistory: false,
      customMaterials: true,
    });

    const newService = new SyncCategoryPreferences(mockStorage);
    expect(newService.getPreferences().annotations).toBe(false);
    expect(newService.getPreferences().quizHistory).toBe(false);
    expect(newService.getPreferences().flashcards).toBe(true);
  });

  describe('Tombstone-Suppression and Outbox Filtering Invariants', () => {
    const TEST_DB_NAME = 'test_sync_category_bypass_vault';
    let db: LunaClairDatabase;

    beforeEach(async () => {
      db = new LunaClairDatabase(TEST_DB_NAME);
      const clock = createClock('device_category_test');
      installSyncHooks(db, clock, (cat) => service.isCategoryEnabled(cat));
      await db.open();
    });

    afterEach(async () => {
      if (db.isOpen()) {
        db.close();
      }
      await Dexie.delete(TEST_DB_NAME);
    });

    it('toggling category off using withOrigin("bypass") emits zero outbox rows and zero tombstones', async () => {
      // Seed an annotation under local origin
      await withOrigin(db, 'local', [db.highlights], async () => {
        await db.highlights.add({
          id: 'hl-toggle-test',
          documentId: 'doc-1',
          text: 'Annotated text',
          color: 'yellow',
          start: 0,
          end: 14,
          createdAt: '2026-10-17T00:00:00.000Z',
        });
      });

      // Clear outbox to simulate synced state
      await db.syncQueue.clear();
      await db.tombstones.clear();

      // Disable category with bypass maintenance
      await service.disableCategory('annotations', async () => {
        const tables = getTablesForCategory('annotations').map((name) => db.table(name));
        await withOrigin(db, 'bypass', tables, async () => {
          await db.highlights.clear();
        });
      });

      expect(service.isCategoryEnabled('annotations')).toBe(false);
      expect(await db.highlights.count()).toBe(0);
      expect(await db.syncQueue.count()).toBe(0);
      expect(await db.tombstones.count()).toBe(0);
    });

    it('skips outbox mutation capture for subsequent local writes when category is disabled', async () => {
      service.setCategoryEnabled('annotations', false);

      await withOrigin(db, 'local', [db.highlights], async () => {
        await db.highlights.add({
          id: 'hl-disabled-category',
          documentId: 'doc-1',
          text: 'Disabled category annotation',
          color: 'blue',
          start: 0,
          end: 10,
          createdAt: '2026-10-17T00:00:00.000Z',
        });
      });

      // Highlight exists locally and is stamped, but outbox has 0 items
      const row = await db.highlights.get('hl-disabled-category');
      expect(row).toBeDefined();
      expect(await db.syncQueue.count()).toBe(0);
      expect(await db.tombstones.count()).toBe(0);
    });
  });
});
