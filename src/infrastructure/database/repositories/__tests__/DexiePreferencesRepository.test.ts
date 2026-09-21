import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import {
  DexiePreferencesRepository,
  AI_SELECTION_THREAD_MODE_KEY,
} from '../DexiePreferencesRepository';

describe('DexiePreferencesRepository — selection thread mode', () => {
  let db: LunaClairDatabase;
  let repo: DexiePreferencesRepository;

  beforeEach(async () => {
    db = new LunaClairDatabase();
    await db.open();
    repo = new DexiePreferencesRepository(db);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  it('defaults to latest when nothing is stored', async () => {
    expect(await repo.getAiSelectionThreadMode()).toBe('latest');
  });

  it('round-trips the stored mode', async () => {
    await repo.setAiSelectionThreadMode('new');
    expect(await repo.getAiSelectionThreadMode()).toBe('new');

    await repo.setAiSelectionThreadMode('latest');
    expect(await repo.getAiSelectionThreadMode()).toBe('latest');
  });

  it('falls back to latest for malformed stored values', async () => {
    await db.preferences.put({ key: AI_SELECTION_THREAD_MODE_KEY, value: 'sometimes' });
    expect(await repo.getAiSelectionThreadMode()).toBe('latest');
  });
});
